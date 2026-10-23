export class SeriesSlugConflictError extends Error {
  constructor() {
    super("Series slug already exists");
  }
}
