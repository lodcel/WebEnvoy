export type CloseoutRequiredHeadersDecision = "PASS" | "FAIL";

export type CloseoutRequiredHeadersBlockerCode =
  | "missing_matrix"
  | "empty_matrix"
  | "invalid_matrix_route"
  | "missing_required_header_definition"
  | "missing_observed_route"
  | "missing_observed_headers"
  | "missing_required_header"
  | "empty_required_header";

export type CloseoutRequiredHeadersBlockerLayer = "matrix" | "observed_headers";

export interface CloseoutRequiredHeadersMatrixRoute {
  route_id: string | null;
  required_headers: Array<string | null | undefined> | null;
}

export interface CloseoutRequiredHeadersObservedRoute {
  route_id: string | null;
  headers: Record<string, string | string[] | null | undefined> | null;
}

export interface EvaluateCloseoutRequiredHeadersMatrixInput {
  matrix: {
    routes: CloseoutRequiredHeadersMatrixRoute[] | null;
  } | null;
  observed_routes: CloseoutRequiredHeadersObservedRoute[] | null;
}

export interface CloseoutRequiredHeadersMatrixEvaluation {
  decision: CloseoutRequiredHeadersDecision;
  passed: boolean;
  blockers: Array<{
    blocker_code: CloseoutRequiredHeadersBlockerCode;
    blocker_layer: CloseoutRequiredHeadersBlockerLayer;
    route_id: string | null;
    header_name: string | null;
    message: string;
  }>;
  route_results: CloseoutRequiredHeadersRouteResult[];
  summary: {
    matrix_present: boolean;
    observed_routes_present: boolean;
    total_routes: number;
    passed_routes: number;
    failed_routes: number;
    blocker_count: number;
  };
  trace: {
    matrix_route_ids: string[];
    observed_route_ids: string[];
    evaluated_route_ids: string[];
  };
}

export interface CloseoutRequiredHeadersRouteResult {
  route_id: string;
  decision: CloseoutRequiredHeadersDecision;
  passed: boolean;
  required_headers: string[];
  observed_header_names: string[];
  missing_headers: string[];
  empty_headers: string[];
  blockers: CloseoutRequiredHeadersMatrixEvaluation["blockers"];
}

const normalizeString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeHeaderName = (value: string | null | undefined): string | null => {
  const normalized = normalizeString(value);
  return normalized === null ? null : normalized.toLowerCase();
};

const normalizeHeaderValuePresent = (
  value: string | string[] | null | undefined
): boolean => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((item) => typeof item === "string" && item.trim().length > 0);
  }
  return false;
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values)).sort();

const blocker = (
  blocker_code: CloseoutRequiredHeadersBlockerCode,
  blocker_layer: CloseoutRequiredHeadersBlockerLayer,
  route_id: string | null,
  header_name: string | null,
  message: string
): CloseoutRequiredHeadersMatrixEvaluation["blockers"][number] => ({
  blocker_code,
  blocker_layer,
  route_id,
  header_name,
  message
});

const normalizeObservedHeaders = (
  headers: CloseoutRequiredHeadersObservedRoute["headers"]
): Map<string, boolean> | null => {
  if (headers === null || headers === undefined || Object.keys(headers).length === 0) {
    return null;
  }

  const normalized = new Map<string, boolean>();
  for (const [name, value] of Object.entries(headers)) {
    const headerName = normalizeHeaderName(name);
    if (headerName === null) {
      continue;
    }
    normalized.set(
      headerName,
      (normalized.get(headerName) ?? false) || normalizeHeaderValuePresent(value)
    );
  }

  return normalized.size > 0 ? normalized : null;
};

const buildObservedRouteMap = (
  observedRoutes: CloseoutRequiredHeadersObservedRoute[] | null
): Map<string, Map<string, boolean> | null> => {
  const observedRouteMap = new Map<string, Map<string, boolean> | null>();
  for (const observedRoute of observedRoutes ?? []) {
    const routeId = normalizeString(observedRoute.route_id);
    if (routeId === null) {
      continue;
    }
    observedRouteMap.set(routeId, normalizeObservedHeaders(observedRoute.headers));
  }
  return observedRouteMap;
};

const buildMatrixRouteIds = (
  routes: CloseoutRequiredHeadersMatrixRoute[] | null | undefined
): string[] =>
  uniqueSorted(
    (routes ?? [])
      .map((route) => normalizeString(route.route_id))
      .filter((routeId): routeId is string => routeId !== null)
  );

const buildObservedRouteIds = (routes: CloseoutRequiredHeadersObservedRoute[] | null): string[] =>
  uniqueSorted(
    (routes ?? [])
      .map((route) => normalizeString(route.route_id))
      .filter((routeId): routeId is string => routeId !== null)
  );

export const evaluateCloseoutRequiredHeadersMatrix = (
  input: EvaluateCloseoutRequiredHeadersMatrixInput
): CloseoutRequiredHeadersMatrixEvaluation => {
  const matrixRoutes = input.matrix?.routes ?? null;
  const matrixPresent = Array.isArray(matrixRoutes);
  const observedRoutesPresent = Array.isArray(input.observed_routes);
  const blockers: CloseoutRequiredHeadersMatrixEvaluation["blockers"] = [];
  const routeResults: CloseoutRequiredHeadersRouteResult[] = [];
  const matrixRouteIds = buildMatrixRouteIds(matrixRoutes);
  const observedRouteIds = buildObservedRouteIds(input.observed_routes);

  if (!matrixPresent) {
    blockers.push(
      blocker(
        "missing_matrix",
        "matrix",
        null,
        null,
        "closeout required headers matrix is required"
      )
    );
  } else if (matrixRoutes.length === 0) {
    blockers.push(
      blocker(
        "empty_matrix",
        "matrix",
        null,
        null,
        "closeout required headers matrix must contain at least one route"
      )
    );
  }

  if (!observedRoutesPresent) {
    blockers.push(
      blocker(
        "missing_observed_headers",
        "observed_headers",
        null,
        null,
        "observed headers are required for closeout matrix evaluation"
      )
    );
  }

  const observedRouteMap = buildObservedRouteMap(input.observed_routes);

  for (const matrixRoute of matrixRoutes ?? []) {
    const routeId = normalizeString(matrixRoute.route_id);
    if (routeId === null) {
      blockers.push(
        blocker(
          "invalid_matrix_route",
          "matrix",
          null,
          null,
          "closeout required headers matrix route_id must be non-empty"
        )
      );
      continue;
    }

    const requiredHeaders = matrixRoute.required_headers ?? null;
    const routeBlockers: CloseoutRequiredHeadersMatrixEvaluation["blockers"] = [];
    const missingHeaders: string[] = [];
    const emptyHeaders: string[] = [];
    const normalizedRequiredHeaders: string[] = [];

    if (requiredHeaders === null || requiredHeaders.length === 0) {
      routeBlockers.push(
        blocker(
          "missing_required_header_definition",
          "matrix",
          routeId,
          null,
          "closeout matrix route must define at least one required header"
        )
      );
    }

    for (const headerName of requiredHeaders ?? []) {
      const normalizedHeaderName = normalizeHeaderName(headerName);
      if (normalizedHeaderName === null) {
        routeBlockers.push(
          blocker(
            "missing_required_header_definition",
            "matrix",
            routeId,
            null,
            "closeout matrix required header names must be non-empty"
          )
        );
        continue;
      }
      normalizedRequiredHeaders.push(normalizedHeaderName);
    }

    const requiredHeaderNames = uniqueSorted(normalizedRequiredHeaders);
    const observedHeaders = observedRouteMap.get(routeId);
    const observedHeaderNames = uniqueSorted(Array.from(observedHeaders?.keys() ?? []));

    if (!observedRouteMap.has(routeId)) {
      routeBlockers.push(
        blocker(
          "missing_observed_route",
          "observed_headers",
          routeId,
          null,
          "observed headers are missing for the matrix route"
        )
      );
    } else if (observedHeaders === null) {
      routeBlockers.push(
        blocker(
          "missing_observed_headers",
          "observed_headers",
          routeId,
          null,
          "observed route must include a non-empty headers object"
        )
      );
    }

    for (const headerName of requiredHeaderNames) {
      if (!observedHeaders?.has(headerName)) {
        missingHeaders.push(headerName);
        routeBlockers.push(
          blocker(
            "missing_required_header",
            "observed_headers",
            routeId,
            headerName,
            "observed route is missing a required header"
          )
        );
        continue;
      }

      if (observedHeaders.get(headerName) !== true) {
        emptyHeaders.push(headerName);
        routeBlockers.push(
          blocker(
            "empty_required_header",
            "observed_headers",
            routeId,
            headerName,
            "observed route contains an empty required header"
          )
        );
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
