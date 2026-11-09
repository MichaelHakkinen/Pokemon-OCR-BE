// class-transformer helper for boolean fields that may arrive as strings
// (query params, multipart form-data). Unlike `value === 'true' || value ===
// true`, anything that isn't a boolean or 'true'/'false' is passed through
// unchanged so @IsBoolean rejects it, instead of it silently becoming false
// (which e.g. deactivated a record on a malformed isActive).
export const toBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};
