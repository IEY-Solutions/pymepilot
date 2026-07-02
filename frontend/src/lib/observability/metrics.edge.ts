export function recordRateLimitRequest(_tenantId: string, _route: string, _decision: string): void {
  void _tenantId;
  void _route;
  void _decision;
}

export function recordAuthValidationDuration(_type: string, _durationSeconds: number): void {
  void _type;
  void _durationSeconds;
}

export function recordRscPrefetch(_route: string, _status: string, _durationSeconds?: number): void {
  void _route;
  void _status;
  void _durationSeconds;
}
