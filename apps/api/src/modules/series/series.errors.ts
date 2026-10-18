// Repository chuyển lỗi unique của database thành lỗi thuộc module.
export class SeriesSlugConflictError extends Error {
  constructor() {
    super('Series slug already exists');
  }
}
