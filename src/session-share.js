function chunk(items, size) {
  if (!Array.isArray(items) || items.length === 0 || size <= 0) {
    return [];
  }
  const rows = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

export function buildSessionEmojiGrid(summaryData, {
  columns = 5,
  correctEmoji = "🟩",
  wrongEmoji = "🟥",
  emptyEmoji = "⬜",
} = {}) {
  if (!Array.isArray(summaryData) || summaryData.length === 0) {
    return emptyEmoji;
  }

  const cells = summaryData.map((item) => (item && item.correct ? correctEmoji : wrongEmoji));
  return chunk(cells, columns)
    .map((row) => row.join(""))
    .join("\n");
}

function getSessionResultLine({
  gameMode,
  zoneMode,
  scorePercent,
  correctCount,
  answeredCount,
  sessionScoreValue,
  poolSize,
}) {
  const itemLabel =
    zoneMode === "monuments"
      ? "monuments"
      : zoneMode === "quartiers-ville"
        ? "quartiers"
        : "rues";
  const foundWord = zoneMode === "monuments" || zoneMode === "quartiers-ville" ? "trouvés" : "trouvées";

  if (gameMode === "marathon") {
    return `🎯 Résultat : ${Math.round(sessionScoreValue)} / ${poolSize || 0} ${itemLabel} ${foundWord}`;
  }

  if (gameMode === "chrono") {
    return `🎯 Résultat : ${Math.round(sessionScoreValue)} ${itemLabel} ${foundWord} en 60 s`;
  }

  return `🎯 Résultat : ${scorePercent}% (${correctCount}/${answeredCount}) • ${sessionScoreValue.toFixed(1)} pts`;
}

export function buildSessionShareText({
  summaryData,
  gameMode,
  zoneMode,
  quartierName,
  totalTimeSec,
  averageTimeSec,
  scorePercent,
  correctCount,
  answeredCount,
  sessionScoreValue,
  poolSize,
  gameLabels,
  zoneLabels,
  now = new Date(),
  host = "camino-ajm.pages.dev",
}) {
  const modeLabel = gameLabels[gameMode] || gameMode;
  const zoneLabel = zoneLabels[zoneMode] || zoneMode;
  const dateLabel = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(now);

  let header = `🗺️ Camino — ${dateLabel}`;
  header += `\n🧩 ${modeLabel} • ${zoneLabel}`;
  if (quartierName) {
    header += ` (${quartierName})`;
  }

  const resultLine = getSessionResultLine({
    gameMode,
    zoneMode,
    scorePercent,
    correctCount,
    answeredCount,
    sessionScoreValue,
    poolSize,
  });

  const timeLine = `⏱️ Temps : ${totalTimeSec.toFixed(1)} s (moyenne ${averageTimeSec.toFixed(1)} s)`;
  const grid = buildSessionEmojiGrid(summaryData);

  return `${header}\n${resultLine}\n${timeLine}\n\n${grid}\n\nEssaie de faire mieux sur ${host}`;
}

export async function copySessionShareText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // fallback below
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return true;
  } catch (error) {
    return false;
  }
}

export async function shareSessionShareText(text) {
  if (!navigator.share) {
    return false;
  }

  try {
    await navigator.share({
      title: "Camino - Résultat de session",
      text,
    });
    return true;
  } catch (error) {
    if (error && error.name === "AbortError") {
      return null;
    }
    return false;
  }
}
