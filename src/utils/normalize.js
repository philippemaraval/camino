export function normalizeName(name) {
  return (name || '').trim().toLowerCase();
}

export function normalizeQuartierKey(raw) {
  if (!raw) return '';

  let s = raw.trim();

  // Cas "Chapitre (Le)" → "Le Chapitre"
  const match = s.match(/^(.+)\s+\((L'|L’|La|Le|Les)\)$/i);
  if (match) {
    let base = match[1].trim();
    let art = match[2].trim();

    // Unifier L' / L’
    if (/^l[’']/i.test(art)) {
      art = "L'";
    } else {
      // Mettre la majuscule standard : La/Le/Les
      art = art.charAt(0).toUpperCase() + art.slice(1).toLowerCase();
    }

    s = `${art} ${base}`;
  }

  // Supprimer les accents, normaliser espaces, mettre en minuscule
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/\s+/g, ' ').toLowerCase();

  return s;
}
