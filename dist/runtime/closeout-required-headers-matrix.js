const normalizeString = (value) => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};
const normalizeHeaderName = (value) => {
    const normalized = normalizeString(value);
    return normalized === null ? null : normalized.toLowerCase();
};
const normalizeHeaderValuePresent = (value) => {
    if (typeof value === "string") {
        return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
        return value.some((item) => typeof item === "string" && item.trim().length > 0);
    }
    return false;
};
const uniqueSorted = (values) => Array.from(new Set(values)).sort();
const blocker = (blocker_code, blocker_layer, route_id, header_name, message) => ({
    blocker_code,
    blocker_layer,
    route_id,
    header_name,
    message
});
const normalizeObservedHeaders = (headers) => {
    if (headers === null || headers === undefined || Object.keys(headers).length === 0) {
        return null;
    }
    const normalized = new Map();
    for (const [name, value] of Object.entries(headers)) {
        const headerName = normalizeHeaderName(name);
        if (headerName === null) {
            continue;
        }
        normalized.set(headerName, (normalized.get(headerName) ?? false) || normalizeHeaderValuePresent(value));
    }
    return normalized.size > 0 ? normalized : null;
};
const buildObservedRouteMap = (observedRoutes) => {
    const observedRouteMap = new Map();
    for (const observedRoute of observedRoutes ?? []) {
        const routeId = normalizeString(observedRoute.route_id);
        if (routeId === null) {
            continue;
        }
        observedRouteMap.set(routeId, normalizeObservedHeaders(observedRoute.headers));
    }
    return observedRouteMap;
};
const buildMatrixRouteIds = (routes) => uniqueSorted((routes ?? [])
    .map((route) => normalizeString(route.route_id))
    .filter((routeId) => routeId !== null));
const buildObservedRouteIds = (routes) => uniqueSorted((routes ?? [])
    .map((route) => normalizeString(route.route_id))
    .filter((routeId) => routeId !== null));
export const evaluateCloseoutRequiredHeadersMatrix = (input) => {
    const matrixRoutes = input.matrix?.routes ?? null;
    const matrixPresent = Array.isArray(matrixRoutes);
    const observedRoutesPresent = Array.isArray(input.observed_routes);
    const blockers = [];
    const routeResults = [];
    const matrixRouteIds = buildMatrixRouteIds(matrixRoutes);
    const observedRouteIds = buildObservedRouteIds(input.observed_routes);
    if (!matrixPresent) {
        blockers.push(blocker("missing_matrix", "matrix", null, null, "closeout required headers matrix is required"));
    }
    else if (matrixRoutes.length === 0) {
        blockers.push(blocker("empty_matrix", "matrix", null, null, "closeout required headers matrix must contain at least one route"));
    }
    if (!observedRoutesPresent) {
        blockers.push(blocker("missing_observed_headers", "observed_headers", null, null, "observed headers are required for closeout matrix evaluation"));
    }
    const observedRouteMap = buildObservedRouteMap(input.observed_routes);
    for (const matrixRoute of matrixRoutes ?? []) {
        const routeId = normalizeString(matrixRoute.route_id);
        if (routeId === null) {
            blockers.push(blocker("invalid_matrix_route", "matrix", null, null, "closeout required headers matrix route_id must be non-empty"));
            continue;
        }
        const requiredHeaders = matrixRoute.required_headers ?? null;
        const routeBlockers = [];
        const missingHeaders = [];
        const emptyHeaders = [];
        const normalizedRequiredHeaders = [];
        if (requiredHeaders === null || requiredHeaders.length === 0) {
            routeBlockers.push(blocker("missing_required_header_definition", "matrix", routeId, null, "closeout matrix route must define at least one required header"));
        }
        for (const headerName of requiredHeaders ?? []) {
            const normalizedHeaderName = normalizeHeaderName(headerName);
            if (normalizedHeaderName === null) {
                routeBlockers.push(blocker("missing_required_header_definition", "matrix", routeId, null, "closeout matrix required header names must be non-empty"));
                continue;
            }
            normalizedRequiredHeaders.push(normalizedHeaderName);
        }
        const requiredHeaderNames = uniqueSorted(normalizedRequiredHeaders);
        const observedHeaders = observedRouteMap.get(routeId);
        const observedHeaderNames = uniqueSorted(Array.from(observedHeaders?.keys() ?? []));
        if (!observedRouteMap.has(routeId)) {
            routeBlockers.push(blocker("missing_observed_route", "observed_headers", routeId, null, "observed headers are missing for the matrix route"));
        }
        else if (observedHeaders === null) {
            routeBlockers.push(blocker("missing_observed_headers", "observed_headers", routeId, null, "observed route must include a non-empty headers object"));
        }
        for (const headerName of requiredHeaderNames) {
            if (!observedHeaders?.has(headerName)) {
                missingHeaders.push(headerName);
                routeBlockers.push(blocker("missing_required_header", "observed_headers", routeId, headerName, "observed route is missing a required header"));
                continue;
            }
            if (observedHeaders.get(headerName) !== true) {
                emptyHeaders.push(headerName);
                routeBlockers.push(blocker("empty_required_header", "observed_headers", routeId, headerName, "observed route contains an empty required header"));
            }
        }
        const passed = routeBlockers.length === 0;
        routeResults.push({
            route_id: routeId,
            decision: passed ? "PASS" : "FAIL",
            passed,
            required_headers: requiredHeaderNames,
            observed_header_names: observedHeaderNames,
            missing_headers: uniqueSorted(missingHeaders),
            empty_headers: uniqueSorted(emptyHeaders),
            blockers: routeBlockers
        });
        blockers.push(...routeBlockers);
    }
    const passed = blockers.length === 0;
    return {
        decision: passed ? "PASS" : "FAIL",
        passed,
        blockers,
        route_results: routeResults,
        summary: {
            matrix_present: matrixPresent,
            observed_routes_present: observedRoutesPresent,
            total_routes: routeResults.length,
            passed_routes: routeResults.filter((routeResult) => routeResult.passed).length,
            failed_routes: routeResults.filter((routeResult) => !routeResult.passed).length,
            blocker_count: blockers.length
        },
        trace: {
            matrix_route_ids: matrixRouteIds,
            observed_route_ids: observedRouteIds,
            evaluated_route_ids: routeResults.map((routeResult) => routeResult.route_id)
        }
    };
};
