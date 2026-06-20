export const isDuplicate = (existing, incoming) => {
  if (!existing || !incoming) return false;

  const strictClean = (str) =>
    String(str || "")
      .toLowerCase()
      .replace(/\s+/g, " ") 
      .trim();

  return (
    strictClean(existing.name) === strictClean(incoming.name) &&
    strictClean(existing.state) === strictClean(incoming.state) &&
    strictClean(existing.ministry) === strictClean(incoming.ministry)
  );
};