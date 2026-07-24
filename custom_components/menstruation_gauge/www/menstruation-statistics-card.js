/**
 * Menstrual Statistics Card
 * Displays cycle statistics, hygiene statistics and a doctor report.
 *
 * Hygiene tab logic is fully inlined here — no separate shared module required.
 */

// ---------------------------------------------------------------------------
// Hygiene tab – inlined constants and helpers
// (formerly menstruation-product-stats-shared.js)
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  tampon_price: 0.12,
  pad_price: 0.10,
  cup_price: 30,
  tampon_co2_g: 1.5,
  pad_co2_g: 2.5,
  cup_co2_g: 18,
  co2_source_url: 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10148749/',
  underwear_total_owned: 12,
  target_wash_days: 7,
};

const HYGIENE_TRANSLATIONS = {
  de: {
    title: 'Produktverbrauch',
    usage_section: 'Verbrauch',
    planning_section: 'Planung',
    sustainability_section: 'Nachhaltigkeit',
    timeline_section: 'Letzte 30 Tage',
    tampons_per_cycle: 'Tampons / Periode',
    pads_per_cycle: 'Binden / Periode',
    cup_empties_per_day: 'Cup-Leerungen / Tag',
    liners_per_cycle: 'Slipeinlagen / Periode',
    underwear_per_cycle: 'Periodenunterwäsche / Periode',
    planning_days: 'Planungstage',
    days: 'Tage',
    last_cycle: 'Letzte Periode',
    last_cycles: ({ count }) => `${count || 0} Zyklen`,
    last_30_days: 'Letzte 30 Tage',
    no_usage_last_30_days: 'In den letzten 30 Tagen wurden keine Produkte geloggt.',
    wash_every_x_days: 'Wasche alle X Tage',
    buy_x_more_underwear: 'Kaufe X mehr Slips',
    based_on_daily_usage: ({ value }) => `bei ~${value || 0} pro Tag`,
    for_wash_goal: ({ days }) => `für alle ${days || 0} Tage Waschrhythmus`,
    add_to_shopping_list: 'Zur Einkaufsliste',
    cup_cost_savings: 'Cup Kostenersparnis',
    cup_co2_savings: 'Cup CO2-Ersparnis',
    annual_projection: 'Jahres-Prognose',
    source: 'Quelle',
    tampon: 'Tampon',
    pad: 'Binde',
    cup: 'Cup',
    cup_empty: 'Cup geleert',
    liner: 'Slipeinlage',
    underwear: 'Periodenunterwäsche',
  },
  en: {
    title: 'Product usage',
    usage_section: 'Usage',
    planning_section: 'Planning',
    sustainability_section: 'Sustainability',
    timeline_section: 'Last 30 days',
    tampons_per_cycle: 'Tampons / period',
    pads_per_cycle: 'Pads / period',
    cup_empties_per_day: 'Cup empties / day',
    liners_per_cycle: 'Liners / period',
    underwear_per_cycle: 'Period underwear / period',
    planning_days: 'Planning days',
    days: 'days',
    last_cycle: 'Last period',
    last_cycles: ({ count }) => `${count || 0} cycles`,
    last_30_days: 'Last 30 days',
    no_usage_last_30_days: 'No products were logged in the last 30 days.',
    wash_every_x_days: 'Wash every X days',
    buy_x_more_underwear: 'Buy X more underwear',
    based_on_daily_usage: ({ value }) => `based on ~${value || 0}/day`,
    for_wash_goal: ({ days }) => `for a ${days || 0}-day wash routine`,
    add_to_shopping_list: 'Add to shopping list',
    cup_cost_savings: 'Cup cost savings',
    cup_co2_savings: 'Cup CO2 savings',
    annual_projection: 'Annual projection',
    source: 'Source',
    tampon: 'Tampon',
    pad: 'Pad',
    cup: 'Cup',
    cup_empty: 'Cup emptied',
    liner: 'Liner',
    underwear: 'Period underwear',
  },
};

function mergeConfig(config) {
  return { ...DEFAULT_CONFIG, ...(config || {}) };
}

function getLang(hass) {
  const language = String(hass?.locale?.language || hass?.language || 'en').toLowerCase();
  return language.startsWith('de') ? 'de' : 'en';
}

function translate(hass, key, placeholders = {}) {
  const lang = getLang(hass);
  const dict = HYGIENE_TRANSLATIONS[lang] || HYGIENE_TRANSLATIONS.en;
  const value = dict[key];
  if (typeof value === 'function') return value(placeholders);
  return value ?? HYGIENE_TRANSLATIONS.en[key] ?? key;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeClassName(value) {
  const sanitized = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return sanitized || 'unknown';
}

function normalizeQuantity(value) {
  let parsed = null;
  if (typeof value === 'number') {
    parsed = value;
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) {
      const match = trimmed.match(/[-+]?\d+(?:[.,]\d+)?/);
      if (match) parsed = Number(match[0].replace(',', '.'));
    }
  }
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.max(1, Math.floor(parsed));
}

function normalizeProductKey(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  const normalized = raw.replace(/-/g, '_');
  return {
    tampon: 'tampon',
    tampons: 'tampon',
    pad: 'pad',
    pads: 'pad',
    binde: 'pad',
    binden: 'pad',
    cup: 'cup',
    cups: 'cup',
    menstrual_cup: 'cup',
    'menstrual cup': 'cup',
    liner: 'liner',
    liners: 'liner',
    pantyliner: 'liner',
    pantyliners: 'liner',
    slipeinlage: 'liner',
    slipeinlagen: 'liner',
    underwear: 'underwear',
    period_underwear: 'underwear',
    'period underwear': 'underwear',
    period_panties: 'underwear',
    'period panties': 'underwear',
    period_panty: 'underwear',
    'period panty': 'underwear',
    periodenunterwaesche: 'underwear',
    'periodenunterwäsche': 'underwear',
  }[normalized] || {
    'period underwear': 'underwear',
    'period panties': 'underwear',
    'period panty': 'underwear',
    'menstrual cup': 'cup',
  }[raw] || raw;
}

function normalizeDateKey(value) {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, year, month, day] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsed.getUTCFullYear() === Number(year)
      && parsed.getUTCMonth() + 1 === Number(month)
      && parsed.getUTCDate() === Number(day)
    ) {
      return `${year}-${month}-${day}`;
    }
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && Number.isInteger(numeric)) {
    const timestamp = Math.abs(numeric) >= 1_000_000_000_000 ? numeric : numeric * 1000;
    const parsed = new Date(timestamp);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}-${String(parsed.getUTCDate()).padStart(2, '0')}`;
    }
  }

  return null;
}

function dateKeyToOrdinal(value) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86400000);
}

function todayOrdinal() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

function formatNumber(value) {
  return Number(value || 0).toFixed(1).replace(/\.0$/, '');
}

function dateLocale(hass) {
  const locale = hass?.locale?.language || hass?.language;
  if (!locale) return getLang(hass);
  try {
    return Intl.getCanonicalLocales(locale)[0] || getLang(hass);
  } catch (_error) {
    return getLang(hass);
  }
}

function formatDate(hass, value) {
  const dateKey = normalizeDateKey(value);
  if (!dateKey) return value;
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  try {
    return new Intl.DateTimeFormat(dateLocale(hass), { month: 'short', day: 'numeric' }).format(date);
  } catch (_error) {
    return value;
  }
}

function getSvgIcon(product) {
  return window.ProductIcons?.getSvgIcon(product) || '';
}

function getUsageData(attrs) {
  return {
    timeline: Array.isArray(attrs?.product_usage_timeline)
      ? attrs.product_usage_timeline
      : (Array.isArray(attrs?.product_usage) ? attrs.product_usage : []),
    thisCycle: attrs?.product_usage_this_cycle && typeof attrs.product_usage_this_cycle === 'object'
      ? attrs.product_usage_this_cycle
      : {},
    statsSource: attrs?.product_usage_stats && typeof attrs.product_usage_stats === 'object'
      ? attrs.product_usage_stats
      : {},
  };
}

function calculateStats(productUsageThisCycle, productUsageStats, daysUntilNextStart) {
  const statsData = productUsageStats?.stats || productUsageStats || {};
  const averagePerCycle = statsData.average_per_cycle || {};
  const cyclesConsidered = Number(statsData.cycles_considered || 0);
  const getCycleValue = (averageKey, currentKey) => {
    const averageValue = Number(averagePerCycle[averageKey]);
    if (cyclesConsidered > 0 || averageValue > 0) return Number.isFinite(averageValue) ? averageValue : 0;
    return Number(productUsageThisCycle?.[currentKey] || 0);
  };

  return {
    cyclesConsidered: Math.max(0, cyclesConsidered),
    tamponsPerCycle: getCycleValue('tampon', 'tampon'),
    padsPerCycle: getCycleValue('pad', 'pad'),
    cupEmptiesPerDay: Number(averagePerCycle.cup ?? averagePerCycle.cup_empties ?? productUsageThisCycle?.cup ?? 0),
    linersPerCycle: getCycleValue('liner', 'liner'),
    underwearPerCycle: getCycleValue('underwear', 'underwear'),
    planningDays: Math.max(0, Number(daysUntilNextStart || 0)),
  };
}

function calculateAverageDailyUsage(productUsage, product) {
  const entries = (Array.isArray(productUsage) ? productUsage : [])
    .map((entry) => ({
      ...entry,
      product: normalizeProductKey(entry?.product),
      date: normalizeDateKey(entry?.date ?? entry?.created_at ?? entry?.logged_at ?? entry?.timestamp),
      quantity: normalizeQuantity(entry?.quantity),
    }))
    .filter((entry) => entry.product === product && entry.date);

  if (!entries.length) return 0;
  const sortedDates = entries.map((entry) => entry.date).sort();
  const start = new Date(`${sortedDates[0]}T00:00:00Z`).getTime();
  const end = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00Z`).getTime();
  const daySpan = Math.max(1, Math.floor((end - start) / 86400000) + 1);
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  return total / daySpan;
}

function calculateUnderwearWashPlan(config, averageDailyUsage) {
  const totalOwned = Math.max(1, Number(config?.underwear_total_owned ?? DEFAULT_CONFIG.underwear_total_owned));
  const targetWashDays = Math.max(1, Number(config?.target_wash_days ?? DEFAULT_CONFIG.target_wash_days));
  if (averageDailyUsage <= 0) return { washEveryDays: 0, washEveryDaysText: '—', buyMore: 0, targetWashDays };
  const washEveryDays = totalOwned / averageDailyUsage;
  const buyMore = Math.max(0, Math.ceil((averageDailyUsage * targetWashDays) - totalOwned));
  return {
    washEveryDays,
    washEveryDaysText: formatNumber(washEveryDays),
    buyMore,
    targetWashDays,
  };
}

function calculateCupSavings(config, productUsage) {
  const entries = Array.isArray(productUsage) ? productUsage : [];
  const cupUseTotal = entries
    .filter((entry) => normalizeProductKey(entry?.product) === 'cup')
    .reduce((sum, entry) => sum + normalizeQuantity(entry?.quantity), 0);
  const cupUsesPerDay = cupUseTotal / 30;
  const annualCupUses = cupUsesPerDay * 365;

  const tamponPrice = Math.max(0, Number(config?.tampon_price ?? DEFAULT_CONFIG.tampon_price));
  const padPrice = Math.max(0, Number(config?.pad_price ?? DEFAULT_CONFIG.pad_price));
  const cupPrice = Math.max(0, Number(config?.cup_price ?? DEFAULT_CONFIG.cup_price));
  const disposableAvgPrice = (tamponPrice + padPrice) / 2;

  const tamponCo2 = Math.max(0, Number(config?.tampon_co2_g ?? DEFAULT_CONFIG.tampon_co2_g));
  const padCo2 = Math.max(0, Number(config?.pad_co2_g ?? DEFAULT_CONFIG.pad_co2_g));
  const cupCo2 = Math.max(0, Number(config?.cup_co2_g ?? DEFAULT_CONFIG.cup_co2_g));
  const disposableAvgCo2 = (tamponCo2 + padCo2) / 2;

  return {
    annualCupUses,
    costSavingsEur: (annualCupUses * disposableAvgPrice) - cupPrice,
    co2SavingsKg: ((annualCupUses * disposableAvgCo2) - cupCo2) / 1000,
  };
}

function productLabel(hass, entry) {
  const product = normalizeProductKey(entry?.product) || entry?.product;
  if (product === 'cup' && entry?.action === 'emptied') return translate(hass, 'cup_empty');
  return {
    tampon: translate(hass, 'tampon'),
    pad: translate(hass, 'pad'),
    cup: translate(hass, 'cup'),
    liner: translate(hass, 'liner'),
    underwear: translate(hass, 'underwear'),
  }[product] || product;
}

function buildMetrics(config, attrs) {
  const mergedConfig = mergeConfig(config);
  const { timeline, thisCycle, statsSource } = getUsageData(attrs);
  const stats = calculateStats(thisCycle, statsSource, attrs?.days_until_next_start);
  const averageDailyUnderwearUsage = calculateAverageDailyUsage(timeline, 'underwear');
  const washPlan = calculateUnderwearWashPlan(mergedConfig, averageDailyUnderwearUsage);
  const cupSavings = calculateCupSavings(mergedConfig, timeline);
  return { mergedConfig, timeline, stats, averageDailyUnderwearUsage, washPlan, cupSavings };
}

function renderMetricBox(metric) {
  return `
    <div class="mgp-stat-box mgp-tone-${escapeClassName(metric.tone || 'neutral')}">
      <div class="mgp-stat-label">${escapeHtml(metric.label)}</div>
      <div class="mgp-stat-value">${metric.value}</div>
      ${metric.detail ? `<div class="mgp-stat-detail">${metric.detail}</div>` : ''}
      ${metric.button ? `<button class="mgp-action-btn" data-action="${escapeHtml(metric.button.action)}" data-quantity="${escapeHtml(String(metric.button.quantity))}">${escapeHtml(metric.button.label)}</button>` : ''}
    </div>`;
}

function renderMetricSection(section) {
  return `
    <div class="mgp-section">
      <div class="mgp-section-header"><span class="mgp-section-icon">${section.icon}</span><span>${escapeHtml(section.title)}</span></div>
      ${section.meta ? `<div class="mgp-section-meta">${section.meta}</div>` : ''}
      <div class="mgp-stat-grid">${section.items.map(renderMetricBox).join('')}</div>
    </div>`;
}

function renderTimeline(hass, productUsage) {
  const usageByDate = new Map();
  const currentDay = todayOrdinal();

  for (const entry of Array.isArray(productUsage) ? productUsage : []) {
    const dateKey = normalizeDateKey(entry?.date ?? entry?.created_at ?? entry?.logged_at ?? entry?.timestamp);
    const productKey = normalizeProductKey(entry?.product);
    if (!dateKey || !productKey) continue;
    const entryOrdinal = dateKeyToOrdinal(dateKey);
    if (entryOrdinal === null) continue;
    const diffDays = currentDay - entryOrdinal;
    if (diffDays < 0 || diffDays >= 30) continue;

    if (!usageByDate.has(dateKey)) usageByDate.set(dateKey, []);
    usageByDate.get(dateKey).push({
      ...entry,
      date: dateKey,
      product: productKey,
      quantity: normalizeQuantity(entry?.quantity),
    });
  }

  const dates = Array.from(usageByDate.keys()).sort().reverse();
  if (!dates.length) return `<div class="mgp-empty-state">${escapeHtml(translate(hass, 'no_usage_last_30_days'))}</div>`;

  return `
    <div class="mgp-timeline-list">
      ${dates.map((dateKey) => `
        <div class="mgp-timeline-row">
          <div class="mgp-timeline-date">${escapeHtml(formatDate(hass, dateKey))}</div>
          <div class="mgp-timeline-items">
            ${usageByDate.get(dateKey).map((entry) => `
              <span class="mgp-chip ${escapeClassName(entry.product)}">
                ${getSvgIcon(entry.product)} × ${normalizeQuantity(entry.quantity)}
              </span>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
}

function renderHygieneContent(hass, config, attrs) {
  const t = (key, placeholders) => translate(hass, key, placeholders);
  const data = buildMetrics(config, attrs);
  const sections = [
    {
      title: t('usage_section'),
      icon: '🧴',
      meta: escapeHtml(t('last_cycles', { count: data.stats.cyclesConsidered })),
      items: [
        { tone: 'tampon', label: t('tampons_per_cycle'), value: escapeHtml(formatNumber(data.stats.tamponsPerCycle)), detail: escapeHtml(t('last_cycles', { count: data.stats.cyclesConsidered })) },
        { tone: 'pad', label: t('pads_per_cycle'), value: escapeHtml(formatNumber(data.stats.padsPerCycle)), detail: escapeHtml(t('last_cycles', { count: data.stats.cyclesConsidered })) },
        { tone: 'cup', label: t('cup_empties_per_day'), value: escapeHtml(formatNumber(data.stats.cupEmptiesPerDay)), detail: escapeHtml(t('last_cycle')) },
        { tone: 'liner', label: t('liners_per_cycle'), value: escapeHtml(formatNumber(data.stats.linersPerCycle)), detail: escapeHtml(t('last_cycles', { count: data.stats.cyclesConsidered })) },
        { tone: 'underwear', label: t('underwear_per_cycle'), value: escapeHtml(formatNumber(data.stats.underwearPerCycle)), detail: escapeHtml(t('last_cycles', { count: data.stats.cyclesConsidered })) },
      ],
    },
    {
      title: t('planning_section'),
      icon: '🧺',
      meta: escapeHtml(t('days')),
      items: [
        { tone: 'neutral', label: t('planning_days'), value: escapeHtml(String(data.stats.planningDays)), detail: escapeHtml(t('days')) },
        { tone: 'success', label: t('wash_every_x_days'), value: escapeHtml(data.washPlan.washEveryDaysText), detail: escapeHtml(t('based_on_daily_usage', { value: formatNumber(data.averageDailyUnderwearUsage) })) },
        {
          tone: 'underwear',
          label: t('buy_x_more_underwear'),
          value: escapeHtml(String(data.washPlan.buyMore)),
          detail: escapeHtml(t('for_wash_goal', { days: data.washPlan.targetWashDays })),
          button: data.washPlan.buyMore > 0
            ? { action: 'add-underwear-shopping', quantity: data.washPlan.buyMore, label: t('add_to_shopping_list') }
            : null,
        },
      ],
    },
    {
      title: t('sustainability_section'),
      icon: '♻️',
      meta: escapeHtml(t('annual_projection')),
      items: [
        { tone: 'cup', label: t('cup_cost_savings'), value: escapeHtml(`€${formatNumber(data.cupSavings.costSavingsEur)}`), detail: escapeHtml(t('annual_projection')) },
        {
          tone: 'cup',
          label: t('cup_co2_savings'),
          value: escapeHtml(`${formatNumber(data.cupSavings.co2SavingsKg)} kg`),
          detail: `${escapeHtml(t('annual_projection'))}${data.mergedConfig.co2_source_url ? ` · <a href="${escapeHtml(data.mergedConfig.co2_source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('source'))}</a>` : ''}`,
        },
      ],
    },
  ];

  return `
    ${sections.map(renderMetricSection).join('')}
    <div class="mgp-section mgp-section-timeline">
      <div class="mgp-section-header"><span class="mgp-section-icon">🗓️</span><span>${escapeHtml(t('timeline_section'))}</span></div>
      ${renderTimeline(hass, data.timeline)}
    </div>`;
}

function getHygieneStyles(options = {}) {
  const embedded = !!options.embedded;
  return `
    ${embedded ? '' : `
    :host {
      display: block;
      --mgp-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
    }
    ha-card {
      background: var(--mgp-card-bg);
      color: var(--primary-text-color, #1f2937);
    }
    .mgp-header {
      padding: 16px 16px 0;
    }
    .mgp-title {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
    }
    .mgp-subtitle {
      margin: 4px 0 0;
      color: var(--secondary-text-color, #6b7280);
      font-size: 0.9rem;
    }
    .mgp-content {
      padding: 8px 16px 16px;
    }`}
    .mgp-section {
      margin-bottom: 16px;
    }
    .mgp-section:last-child {
      margin-bottom: 0;
    }
    .mgp-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 14px;
      margin-bottom: 8px;
      color: var(--primary-text-color, #1f2937);
    }
    .mgp-section-icon {
      font-size: 15px;
    }
    .mgp-section-meta {
      font-size: 11px;
      color: var(--secondary-text-color, #6b7280);
      margin-bottom: 8px;
    }
    .mgp-stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
      gap: 8px;
    }
    .mgp-stat-box {
      background: var(--secondary-background-color, #f5f5f5);
      border-radius: 10px;
      padding: 10px 12px;
      border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.25));
      min-height: 84px;
      box-sizing: border-box;
    }
    .mgp-stat-label {
      color: var(--secondary-text-color, #6b7280);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.3;
    }
    .mgp-stat-value {
      margin-top: 6px;
      font-size: 1.28rem;
      line-height: 1.2;
      font-weight: 700;
      color: var(--primary-text-color, #1f2937);
    }
    .mgp-stat-detail {
      margin-top: 4px;
      color: var(--secondary-text-color, #6b7280);
      font-size: 11px;
      line-height: 1.35;
    }
    .mgp-action-btn {
      margin-top: 8px;
      width: 100%;
      min-height: 34px;
      border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.35));
      border-radius: 8px;
      padding: 6px 10px;
      background: var(--card-background-color, #fff);
      color: var(--primary-text-color, #1f2937);
      cursor: pointer;
      font: inherit;
    }
    .mgp-empty-state {
      color: var(--secondary-text-color, #6b7280);
      font-size: 12px;
      padding: 6px 0;
    }
    .mgp-timeline-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mgp-timeline-row {
      display: grid;
      grid-template-columns: 86px 1fr;
      gap: 10px;
      align-items: start;
    }
    .mgp-timeline-date {
      color: var(--secondary-text-color, #6b7280);
      font-size: 0.8rem;
      padding-top: 4px;
    }
    .mgp-timeline-items {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .mgp-chip {
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 0.8rem;
      font-weight: 600;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .mgp-chip svg,
    .mgp-chip img {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      object-fit: contain;
      display: block;
    }
    .mgp-tone-tampon,
    .mgp-chip.tampon {
      background: color-mix(in srgb, var(--error-color, #e74c3c) 10%, transparent);
      border-color: color-mix(in srgb, var(--error-color, #e74c3c) 22%, transparent);
    }
    .mgp-tone-pad,
    .mgp-chip.pad {
      background: color-mix(in srgb, var(--warning-color, #f39c12) 12%, transparent);
      border-color: color-mix(in srgb, var(--warning-color, #f39c12) 24%, transparent);
    }
    .mgp-tone-cup,
    .mgp-chip.cup {
      background: color-mix(in srgb, #8e44ad 12%, transparent);
      border-color: color-mix(in srgb, #8e44ad 24%, transparent);
    }
    .mgp-tone-liner,
    .mgp-tone-underwear,
    .mgp-chip.liner,
    .mgp-chip.underwear {
      background: color-mix(in srgb, #3498db 10%, transparent);
      border-color: color-mix(in srgb, #3498db 22%, transparent);
    }
    .mgp-tone-success {
      background: color-mix(in srgb, var(--success-color, #27ae60) 10%, transparent);
      border-color: color-mix(in srgb, var(--success-color, #27ae60) 22%, transparent);
    }
    .mgp-tone-neutral {
      background: color-mix(in srgb, var(--primary-color, #c0392b) 6%, transparent);
      border-color: color-mix(in srgb, var(--primary-color, #c0392b) 16%, transparent);
    }
    @media (max-width: 480px) {
      .mgp-stat-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .mgp-stat-box {
        min-height: 76px;
        padding: 8px 10px;
      }
      .mgp-timeline-row {
        grid-template-columns: 74px 1fr;
      }
    }`;
}

// ---------------------------------------------------------------------------
// MenstruationStatisticsCard – card class
// ---------------------------------------------------------------------------

class MenstruationStatisticsCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstruation-statistics-card',
      entity: '',
      title: '',
      days_back: 180,
      language: 'auto',
      ...DEFAULT_CONFIG,
    };
  }

  static getConfigElement() {
    return document.createElement('menstruation-statistics-card-editor');
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      title: '',
      days_back: 180,
      language: 'auto',
      ...DEFAULT_CONFIG,
      ...config,
    };
    this._tab = this._tab || 'stats';
    this._settingsOpen = this._settingsOpen || false;
    this._exportStatus = null;
    this._patientName = '';
    this._patientBirthdate = '';
    this._exportLanguage = null;
    this._daysBack = parseInt(this._config.days_back, 10) || 180;
    this._ensureRoot();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() { return 6; }

  _ensureRoot() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
  }

  _lang() {
    const cfg = String(this._config?.language || 'auto').toLowerCase();
    if (cfg !== 'auto') return cfg.startsWith('de') ? 'de' : 'en';
    const locale = String(this._hass?.locale?.language || this._hass?.language || 'en').toLowerCase();
    return locale.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        title: 'Statistiken',
        tab_period: 'Periode',
        tab_hygiene: 'Hygiene',
        tab_doctor: 'Arzt-Bericht',
        filter: 'Filter',
        filter_aria: 'Statistik-Filter öffnen',
        no_data: 'Keine Daten vorhanden',
        entity_not_found: 'Entity nicht gefunden',
        cycle_length: 'Zykluslänge',
        bleeding_duration: 'Blutungsdauer',
        bleeding_strength: 'Blutungsstärke',
        regularity: 'Regelmäßigkeit',
        top_symptoms: 'Häufigste Symptome',
        pain_trend: 'Schmerztage-Trend',
        avg: 'Ø',
        min: 'Min',
        max: 'Max',
        std_dev: 'Stabw.',
        days: 'Tage',
        cycles_analyzed: 'Analysierte Zyklen',
        very_regular: 'Sehr regelmäßig',
        regular: 'Regelmäßig',
        irregular: 'Unregelmäßig',
        bleeding_none: 'Keine',
        bleeding_light: 'Leicht',
        bleeding_medium: 'Normal',
        bleeding_heavy: 'Stark',
        bleeding_very_heavy: 'Sehr stark',
        period: 'Zeitraum',
        months_3: '3 Monate',
        months_6: '6 Monate',
        months_12: '12 Monate',
        custom: 'Benutzerdefiniert',
        doctor_report_title: 'Arzt-Bericht',
        doctor_report_desc: 'Erstellt einen professionellen HTML-Bericht für den Arzttermin. Speichert die Datei im Export-Verzeichnis von Home Assistant.',
        patient_name: 'Patientenname (optional)',
        patient_birthdate: 'Geburtsdatum (optional, JJJJ-MM-TT)',
        export_language: 'Berichtssprache',
        export_btn: 'Als HTML für Arzt exportieren',
        export_ok: '✅ Bericht exportiert!',
        export_err: '❌ Fehler beim Exportieren',
        exporting: '⏳ Wird exportiert…',
        print_btn: 'Seite drucken / Als PDF speichern',
        settings_title: 'Einstellungen',
        days_back_label: 'Anzahl Tage zurück',
        cycle_start: 'Zyklusbeginn',
        pain_days: 'Schmerztage',
        avg_pain_days: 'Ø Schmerztage/Zyklus',
        of: 'von',
        last_n_days: (n) => `Letzte ${n} Tage`,
        no_symptom_data: 'Keine Symptomdaten',
        no_cycle_data: 'Keine Zyklusdaten',
      },
      en: {
        title: 'Statistics',
        tab_period: 'Period',
        tab_hygiene: 'Hygiene',
        tab_doctor: 'Doctor Report',
        filter: 'Filter',
        filter_aria: 'Open statistics filters',
        no_data: 'No data available',
        entity_not_found: 'Entity not found',
        cycle_length: 'Cycle Length',
        bleeding_duration: 'Bleeding Duration',
        bleeding_strength: 'Bleeding Strength',
        regularity: 'Regularity',
        top_symptoms: 'Top Symptoms',
        pain_trend: 'Pain Days Trend',
        avg: 'Avg',
        min: 'Min',
        max: 'Max',
        std_dev: 'Std Dev',
        days: 'days',
        cycles_analyzed: 'Cycles analyzed',
        very_regular: 'Very regular',
        regular: 'Regular',
        irregular: 'Irregular',
        bleeding_none: 'None',
        bleeding_light: 'Light',
        bleeding_medium: 'Medium',
        bleeding_heavy: 'Heavy',
        bleeding_very_heavy: 'Very heavy',
        period: 'Period',
        months_3: '3 months',
        months_6: '6 months',
        months_12: '12 months',
        custom: 'Custom',
        doctor_report_title: 'Doctor Report',
        doctor_report_desc: 'Generates a professional HTML report for doctor appointments. Saves the file to the Home Assistant export directory.',
        patient_name: 'Patient name (optional)',
        patient_birthdate: 'Date of birth (optional, YYYY-MM-DD)',
        export_language: 'Report language',
        export_btn: 'Export HTML for Doctor',
        export_ok: '✅ Report exported!',
        export_err: '❌ Export failed',
        exporting: '⏳ Exporting…',
        print_btn: 'Print page / Save as PDF',
        settings_title: 'Settings',
        days_back_label: 'Days back',
        cycle_start: 'Cycle start',
        pain_days: 'Pain days',
        avg_pain_days: 'Avg pain days/cycle',
        of: 'of',
        last_n_days: (n) => `Last ${n} days`,
        no_symptom_data: 'No symptom data',
        no_cycle_data: 'No cycle data',
      },
    };
    const lang = this._lang();
    const dict = i18n[lang] || i18n.en;
    const val = dict[key];
    return val !== undefined ? val : (i18n.en[key] ?? key);
  }

  _getAttrs() {
    if (!this._hass || !this._config) return null;
    const entityId = this._config.entity;
    if (!entityId) return null;
    const stateObj = this._hass.states[entityId];
    if (!stateObj) return null;
    return stateObj.attributes || {};
  }

  _filterOptions() {
    return [
      { value: 90, label: this._t('months_3') },
      { value: 180, label: this._t('months_6') },
      { value: 365, label: this._t('months_12') },
    ];
  }

  _currentFilterLabel() {
    const selected = this._filterOptions().find((option) => option.value === this._daysBack);
    return selected ? selected.label : this._t('custom');
  }

  _computeStats(attrs) {
    if (!attrs) return null;
    const today = new Date();
    const cutoffMs = today.getTime() - this._daysBack * 86400000;
    const cutoffIso = new Date(cutoffMs).toISOString().slice(0, 10);

    const rawHistory = Array.isArray(attrs.history) ? attrs.history : [];
    const history = rawHistory.filter(d => d >= cutoffIso).sort();

    const rawStarts = Array.isArray(attrs.grouped_starts) ? attrs.grouped_starts : [];
    const starts = rawStarts.filter(d => d >= cutoffIso);

    const cycleStats = attrs.cycle_statistics || {};
    const symptomStats = attrs.symptom_statistics || {};
    const bleedingBlocks = Array.isArray(attrs.bleeding_blocks) ? attrs.bleeding_blocks : [];

    const allStarts = rawStarts.filter(d => typeof d === 'string');
    const cycleLengths = [];
    for (let i = 1; i < allStarts.length; i++) {
      const s0 = new Date(allStarts[i - 1]);
      const s1 = new Date(allStarts[i]);
      if (s0 < new Date(cutoffIso)) continue;
      const len = Math.round((s1 - s0) / 86400000);
      if (len > 10 && len < 80) cycleLengths.push(len);
    }

    const avg = cycleLengths.length
      ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length * 10) / 10
      : null;
    const minLen = cycleLengths.length ? Math.min(...cycleLengths) : null;
    const maxLen = cycleLengths.length ? Math.max(...cycleLengths) : null;
    const stdDev = cycleLengths.length >= 2
      ? (() => {
          const m = avg;
          const variance = cycleLengths.reduce((a, b) => a + Math.pow(b - m, 2), 0) / cycleLengths.length;
          return Math.round(Math.sqrt(variance) * 10) / 10;
        })()
      : 0;

    let regularity = null;
    if (stdDev !== null && cycleLengths.length >= 2) {
      regularity = stdDev <= 2 ? 'very_regular' : stdDev <= 5 ? 'regular' : 'irregular';
    }

    const durations = bleedingBlocks
      .filter(b => b && b.start >= cutoffIso)
      .map(b => {
        if (b.length) return b.length;
        if (b.start && b.end) {
          return Math.round((new Date(b.end) - new Date(b.start)) / 86400000) + 1;
        }
        return null;
      })
      .filter(d => d !== null && d > 0);

    const avgBleed = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10
      : null;
    const minBleed = durations.length ? Math.min(...durations) : null;
    const maxBleed = durations.length ? Math.max(...durations) : null;

    const symptomHistory = Array.isArray(attrs.symptom_history) ? attrs.symptom_history : [];
    const recentSymptoms = symptomHistory.filter(s => s.date >= cutoffIso);

    const bsCount = {};
    for (const s of recentSymptoms) {
      const bs = s.bleeding_strength;
      if (bs) bsCount[bs] = (bsCount[bs] || 0) + 1;
    }
    const bsTotal = Object.values(bsCount).reduce((a, b) => a + b, 0);
    const bsDist = bsTotal > 0
      ? Object.entries(bsCount).map(([k, v]) => ({ key: k, pct: Math.round(v / bsTotal * 100) })).sort((a, b) => b.pct - a.pct)
      : [];

    const symCount = {};
    const numCycles = Math.max(1, cycleLengths.length);
    for (const s of recentSymptoms) {
      const pain = Array.isArray(s.pain) ? s.pain : (s.pain ? [s.pain] : []);
      for (const p of pain) symCount[`pain:${p}`] = (symCount[`pain:${p}`] || 0) + 1;
      for (const key of ['spotting', 'discharge', 'intercourse', 'cervical_mucus']) {
        if (s[key]) symCount[`${key}:${s[key]}`] = (symCount[`${key}:${s[key]}`] || 0) + 1;
      }
    }
    const topSymptoms = Object.entries(symCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => ({ key: k, count: v, pct: Math.round(v / numCycles * 100) }));

    const cycleStarts = rawStarts.filter(d => d >= cutoffIso);
    const painTrend = cycleStarts.map((startIso, idx) => {
      const endIso = cycleStarts[idx + 1]
        ? (() => { const d = new Date(cycleStarts[idx + 1]); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })()
        : today.toISOString().slice(0, 10);
      const painDays = recentSymptoms.filter(s => s.date >= startIso && s.date <= endIso && (s.pain && (Array.isArray(s.pain) ? s.pain.length > 0 : true))).length;
      return { cycleStart: startIso, painDays };
    });

    return {
      history,
      starts,
      cycleStats,
      symptomStats,
      cycleLengths,
      avg,
      minLen,
      maxLen,
      stdDev,
      regularity,
      avgBleed,
      minBleed,
      maxBleed,
      bsDist,
      topSymptoms,
      painTrend,
      cyclesAnalyzed: cycleLengths.length,
    };
  }

  _symLabel(key) {
    const lang = this._lang();
    const labels = {
      'pain:cramps': { de: 'Krämpfe', en: 'Cramps' },
      'pain:mittelschmerz': { de: 'Mittelschmerz', en: 'Mittelschmerz' },
      'pain:tender_breasts': { de: 'Brustspannen', en: 'Tender breasts' },
      'pain:headache': { de: 'Kopfschmerzen', en: 'Headache' },
      'pain:migraine': { de: 'Migräne', en: 'Migraine' },
      'pain:lower_back': { de: 'Rückenschmerzen', en: 'Lower back pain' },
      'pain:vulva': { de: 'Vulvaschmerzen', en: 'Vulva pain' },
      'spotting:red': { de: 'Schmierblutung (rot)', en: 'Spotting (red)' },
      'spotting:brown': { de: 'Schmierblutung (braun)', en: 'Spotting (brown)' },
      'hygiene:tampon': { de: 'Tampon', en: 'Tampon' },
      'hygiene:pad': { de: 'Binde', en: 'Pad' },
      'hygiene:cup': { de: 'Menstruationstasse', en: 'Cup' },
      'hygiene:liner': { de: 'Slipeinlage', en: 'Liner' },
      'hygiene:period_underwear': { de: 'Periodenunterwäsche', en: 'Period underwear' },
      'intercourse:protected': { de: 'Geschützter GV', en: 'Protected intercourse' },
      'intercourse:unprotected': { de: 'Ungeschützter GV', en: 'Unprotected intercourse' },
      'cervical_mucus:keinen': { de: 'Kein Schleim', en: 'No mucus' },
      'cervical_mucus:klebrig': { de: 'Klebrig', en: 'Sticky' },
      'cervical_mucus:cremig': { de: 'Cremig', en: 'Creamy' },
      'cervical_mucus:fadenziehend': { de: 'Fadenziehend', en: 'Stretchy' },
    };
    const entry = labels[key];
    if (entry) return entry[lang] || entry.en || key;
    return key.replace(/[:_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  _bsLabel(key) {
    const lang = this._lang();
    const map = {
      none: { de: 'Keine', en: 'None' },
      keine: { de: 'Keine', en: 'None' },
      light: { de: 'Leicht', en: 'Light' },
      medium: { de: 'Normal', en: 'Medium' },
      heavy: { de: 'Stark', en: 'Heavy' },
      very_heavy: { de: 'Sehr stark', en: 'Very heavy' },
    };
    const entry = map[key];
    if (entry) return entry[lang] || entry.en || key;
    return key;
  }

  _renderStatsBars(items, labelFn) {
    if (!items || !items.length) return `<div class="no-data">${this._t('no_data')}</div>`;
    return items.map(item => `
      <div class="bar-row">
        <span class="bar-label">${this._escHtml(labelFn(item.key || item))}</span>
        <div class="bar-outer">
          <div class="bar-fill" style="width:${Math.min(item.pct, 100)}%"></div>
        </div>
        <span class="bar-pct">${item.pct}%</span>
      </div>`).join('');
  }

  _renderPainSparkline(painTrend) {
    if (!painTrend || !painTrend.length) return `<div class="no-data">${this._t('no_data')}</div>`;
    const maxPain = Math.max(...painTrend.map(p => p.painDays), 1);
    const w = 240, h = 60, pad = 4;
    const pts = painTrend.map((p, i) => {
      const x = pad + (i / Math.max(painTrend.length - 1, 1)) * (w - 2 * pad);
      const y = h - pad - (p.painDays / maxPain) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const avgPain = Math.round(painTrend.reduce((a, b) => a + b.painDays, 0) / painTrend.length * 10) / 10;
    return `
      <svg viewBox="0 0 ${w} ${h}" style="width:100%;max-width:${w}px;height:${h}px;overflow:visible">
        <polyline points="${pts}" fill="none" stroke="var(--mg-accent,#c0392b)" stroke-width="2" stroke-linejoin="round"/>
        ${painTrend.map((p, i) => {
          const x = pad + (i / Math.max(painTrend.length - 1, 1)) * (w - 2 * pad);
          const y = h - pad - (p.painDays / maxPain) * (h - 2 * pad);
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--mg-accent,#c0392b)"><title>${p.cycleStart}: ${p.painDays} ${this._t('pain_days')}</title></circle>`;
        }).join('')}
      </svg>
      <div class="sparkline-legend">${this._t('avg_pain_days')}: <strong>${avgPain}</strong></div>`;
  }

  _renderStatsTab(stats) {
    if (!stats) return `<div class="no-data">${this._t('no_cycle_data')}</div>`;
    const t = (k) => this._t(k);
    const esc = (s) => this._escHtml(String(s));

    const hasCycle = stats.cycleLengths.length > 0;
    const cycleHtml = hasCycle ? `
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${stats.avg}</div><div class="stat-key">${t('avg')} (${t('days')})</div></div>
        <div class="stat-box"><div class="stat-val">${stats.minLen}</div><div class="stat-key">${t('min')}</div></div>
        <div class="stat-box"><div class="stat-val">${stats.maxLen}</div><div class="stat-key">${t('max')}</div></div>
        <div class="stat-box"><div class="stat-val">±${stats.stdDev}</div><div class="stat-key">${t('std_dev')}</div></div>
      </div>` : `<div class="no-data">${t('no_cycle_data')}</div>`;

    const regularity = stats.regularity ? `<div class="regularity-badge reg-${esc(stats.regularity)}">${esc(t(stats.regularity))}</div>` : '';

    const bleedHtml = stats.avgBleed !== null ? `
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${stats.avgBleed}</div><div class="stat-key">${t('avg')} (${t('days')})</div></div>
        <div class="stat-box"><div class="stat-val">${stats.minBleed}</div><div class="stat-key">${t('min')}</div></div>
        <div class="stat-box"><div class="stat-val">${stats.maxBleed}</div><div class="stat-key">${t('max')}</div></div>
      </div>` : `<div class="no-data">${t('no_data')}</div>`;

    const bsHtml = this._renderStatsBars(stats.bsDist, (k) => this._bsLabel(k));
    const symHtml = this._renderStatsBars(stats.topSymptoms, (k) => this._symLabel(k));
    const painHtml = this._renderPainSparkline(stats.painTrend);

    return `
      <div class="section">
        <div class="section-header">
          <span class="section-icon">📅</span>
          <span>${esc(t('cycle_length'))}</span>
          ${regularity}
        </div>
        <div class="section-meta">${t('cycles_analyzed')}: <strong>${stats.cyclesAnalyzed}</strong> &middot; ${t('of')} ${esc(String(this._daysBack))} ${t('days')}</div>
        ${cycleHtml}
      </div>
      <div class="section">
        <div class="section-header"><span class="section-icon">🩸</span><span>${esc(t('bleeding_duration'))}</span></div>
        ${bleedHtml}
      </div>
      <div class="section">
        <div class="section-header"><span class="section-icon">💧</span><span>${esc(t('bleeding_strength'))}</span></div>
        ${bsHtml}
      </div>
      <div class="section">
        <div class="section-header"><span class="section-icon">🏥</span><span>${esc(t('top_symptoms'))}</span></div>
        ${symHtml}
      </div>
      <div class="section">
        <div class="section-header"><span class="section-icon">😣</span><span>${esc(t('pain_trend'))}</span></div>
        ${painHtml}
      </div>`;
  }

  _renderHygieneTab(attrs) {
    return `<div class="hygiene-tab">${renderHygieneContent(this._hass, this._config, attrs || {})}</div>`;
  }

  _renderDoctorTab() {
    const t = (k) => this._t(k);
    const exportLang = this._exportLanguage || this._lang();
    const btnLabel = this._exportStatus === 'loading' ? t('exporting')
      : this._exportStatus === 'ok' ? t('export_ok')
      : this._exportStatus === 'err' ? t('export_err')
      : t('export_btn');
    const btnDisabled = this._exportStatus === 'loading' ? 'disabled' : '';

    return `
      <div class="section">
        <div class="section-header"><span class="section-icon">🏥</span><span>${this._escHtml(t('doctor_report_title'))}</span></div>
        <p class="description">${this._escHtml(t('doctor_report_desc'))}</p>
        <div class="form-field">
          <label>${this._escHtml(t('patient_name'))}</label>
          <input type="text" id="patient-name" value="${this._escHtml(this._patientName)}" placeholder="${this._escHtml(t('patient_name'))}" />
        </div>
        <div class="form-field">
          <label>${this._escHtml(t('patient_birthdate'))}</label>
          <input type="text" id="patient-birthdate" value="${this._escHtml(this._patientBirthdate)}" placeholder="YYYY-MM-DD" pattern="\\d{4}-\\d{2}-\\d{2}" />
        </div>
        <div class="form-field">
          <label>${this._escHtml(t('export_language'))}</label>
          <select id="export-lang">
            <option value="de" ${exportLang === 'de' ? 'selected' : ''}>Deutsch</option>
            <option value="en" ${exportLang === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
        <button class="export-btn" id="export-btn" ${btnDisabled}>${this._escHtml(btnLabel)}</button>
        ${this._exportStatus === 'ok' ? '<p class="export-hint">📁 Die Datei wurde im HA-Export-Verzeichnis gespeichert.<br>Öffnen Sie sie im Browser und wählen Sie <em>Drucken → Als PDF speichern</em>.</p>' : ''}
      </div>`;
  }

  _renderFilterMenu() {
    return `
      <div class="filter-popover ${this._settingsOpen ? 'open' : ''}">
        <div class="section-header compact"><span class="section-icon">⚙️</span><span>${this._escHtml(this._t('days_back_label'))}</span></div>
        <div class="days-buttons compact">
          ${this._filterOptions().map(o => `<button class="days-btn ${this._daysBack === o.value ? 'active' : ''}" data-days="${o.value}">${this._escHtml(o.label)}</button>`).join('')}
        </div>
      </div>`;
  }

  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._ensureRoot();

    const entityId = this._config.entity;
    const stateObj = entityId ? this._hass.states[entityId] : null;
    if (entityId && !stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">${this._escHtml(this._t('entity_not_found'))}: ${this._escHtml(entityId)}</div></ha-card>`;
      return;
    }

    const attrs = stateObj ? (stateObj.attributes || {}) : {};
    const stats = this._computeStats(attrs);
    const title = this._config.title || this._t('title');
    const tab = this._tab;
    const t = (k) => this._t(k);
    const productStyles = getHygieneStyles({ embedded: true });

    let tabContent = '';
    if (tab === 'stats') tabContent = this._renderStatsTab(stats);
    else if (tab === 'hygiene') tabContent = this._renderHygieneTab(attrs);
    else if (tab === 'doctor') tabContent = this._renderDoctorTab();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 16px 16px; }
        .card-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--primary-text-color); }
        .toolbar-wrap { position: relative; margin-bottom: 12px; }
        .tab-toolbar { display: flex; align-items: flex-end; gap: 8px; }
        .tabs { flex: 1; display: flex; gap: 4px; border-bottom: 2px solid var(--divider-color, #ddd); padding-bottom: 0; }
        .tab-btn { flex: 1; padding: 8px 4px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--secondary-text-color, #888); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
        .tab-btn.active { color: var(--primary-color, #c0392b); border-bottom-color: var(--primary-color, #c0392b); }
        .tab-btn:hover:not(.active) { color: var(--primary-text-color); }
        .filter-toggle { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--divider-color, #ddd); background: var(--card-background-color, #fff); color: var(--primary-text-color); cursor: pointer; }
        .filter-toggle .filter-glyph { font-size: 16px; line-height: 1; display: inline-block; }
        .filter-popover { display: none; margin-top: 8px; border: 1px solid var(--divider-color, #ddd); border-radius: 12px; padding: 10px; background: var(--ha-card-background, var(--card-background-color, #fff)); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12); }
        .filter-popover.open { display: block; }
        .section { margin-bottom: 20px; }
        .section-header { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--primary-text-color); }
        .section-header.compact { margin-bottom: 10px; }
        .section-icon { font-size: 16px; }
        .section-meta { font-size: 11px; color: var(--secondary-text-color, #888); margin-bottom: 8px; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(82px, 1fr)); gap: 8px; }
        .stat-box { background: var(--secondary-background-color, #f5f5f5); border-radius: 8px; padding: 8px; text-align: center; border: 1px solid var(--divider-color, rgba(128, 128, 128, 0.18)); }
        .stat-val { font-size: 18px; font-weight: 700; color: var(--primary-color, #c0392b); }
        .stat-key { font-size: 10px; color: var(--secondary-text-color, #888); margin-top: 2px; }
        .regularity-badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: auto; }
        .reg-very_regular { background: color-mix(in srgb, var(--success-color, #27ae60) 16%, transparent); color: var(--success-color, #27ae60); }
        .reg-regular { background: color-mix(in srgb, var(--warning-color, #f39c12) 16%, transparent); color: var(--warning-color, #f39c12); }
        .reg-irregular { background: color-mix(in srgb, var(--error-color, #e74c3c) 14%, transparent); color: var(--error-color, #e74c3c); }
        .bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .bar-label { flex: 0 0 120px; font-size: 12px; color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bar-outer { flex: 1; height: 10px; background: var(--secondary-background-color, #f0f0f0); border-radius: 5px; overflow: hidden; }
        .bar-fill { height: 100%; background: var(--primary-color, #c0392b); border-radius: 5px; transition: width 0.4s; }
        .bar-pct { flex: 0 0 36px; font-size: 11px; color: var(--secondary-text-color, #888); text-align: right; }
        .sparkline-legend { font-size: 11px; color: var(--secondary-text-color, #888); margin-top: 4px; }
        .no-data { color: var(--secondary-text-color, #888); font-size: 12px; padding: 8px 0; }
        .description { font-size: 12px; color: var(--secondary-text-color, #888); margin-bottom: 12px; line-height: 1.5; }
        .form-field { margin-bottom: 12px; }
        .form-field label { display: block; font-size: 12px; color: var(--secondary-text-color, #888); margin-bottom: 4px; }
        .form-field input, .form-field select { width: 100%; padding: 8px; border: 1px solid var(--divider-color, #ddd); border-radius: 6px; font-size: 13px; background: var(--card-background-color, #fff); color: var(--primary-text-color); }
        .export-btn { width: 100%; padding: 10px; border: none; border-radius: 8px; background: var(--primary-color, #c0392b); color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .export-btn:hover { opacity: 0.85; }
        .export-btn:disabled { opacity: 0.5; cursor: default; }
        .export-hint { font-size: 11px; color: var(--secondary-text-color, #888); margin-top: 8px; line-height: 1.5; }
        .days-buttons { display: flex; gap: 8px; }
        .days-buttons.compact { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .days-btn { min-height: 34px; padding: 8px; border: 1px solid var(--divider-color, #ddd); border-radius: 8px; background: var(--secondary-background-color, #f5f5f5); cursor: pointer; font-size: 12px; color: var(--primary-text-color); }
        .days-btn.active { background: var(--primary-color, #c0392b); color: #fff; border-color: var(--primary-color, #c0392b); }
        .empty { padding: 20px; text-align: center; color: var(--secondary-text-color, #888); }
        .hygiene-tab { min-height: 0; }
        ${productStyles}
        @media (max-width: 480px) {
          ha-card { padding: 12px; }
          .tab-toolbar { align-items: stretch; }
          .tabs { gap: 2px; }
          .tab-btn { font-size: 11px; }
          .bar-label { flex-basis: 96px; }
          .days-buttons.compact { grid-template-columns: 1fr; }
        }
      </style>
      <ha-card>
        ${title ? `<div class="card-title">${this._escHtml(title)}</div>` : ''}
        <div class="toolbar-wrap">
          <div class="tab-toolbar">
            <div class="tabs">
              <button class="tab-btn ${tab === 'stats' ? 'active' : ''}" data-tab="stats">${this._escHtml(t('tab_period'))}</button>
              <button class="tab-btn ${tab === 'hygiene' ? 'active' : ''}" data-tab="hygiene">${this._escHtml(t('tab_hygiene'))}</button>
              <button class="tab-btn ${tab === 'doctor' ? 'active' : ''}" data-tab="doctor">${this._escHtml(t('tab_doctor'))}</button>
            </div>
            <button class="filter-toggle" id="statistics-filter-toggle" title="${this._escHtml(`${t('filter')}: ${this._currentFilterLabel()}`)}" aria-label="${this._escHtml(t('filter_aria'))}"><span class="filter-glyph">⚙</span></button>
          </div>
          ${this._renderFilterMenu()}
        </div>
        <div class="tab-content">${tabContent}</div>
      </ha-card>`;

    this._attachListeners();
  }

  _attachListeners() {
    const root = this.shadowRoot;
    if (!root) return;

    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.tab;
        if (!nextTab || nextTab === this._tab) return;
        this._tab = nextTab;
        this._settingsOpen = false;
        this._exportStatus = null;
        this._render();
      });
    });

    const toggle = root.getElementById('statistics-filter-toggle');
    if (toggle) {
      toggle.addEventListener('click', () => {
        this._settingsOpen = !this._settingsOpen;
        this._render();
      });
    }

    root.querySelectorAll('.days-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextDays = parseInt(btn.dataset.days, 10);
        if (Number.isNaN(nextDays)) return;
        const changed = nextDays !== this._daysBack;
        this._daysBack = nextDays;
        this._settingsOpen = false;
        if (changed || this._settingsOpen) {
          this._render();
        } else {
          this._render();
        }
      });
    });

    root.querySelectorAll('button[data-action="add-underwear-shopping"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!this._hass) return;
        const quantity = Math.max(1, Number(btn.dataset.quantity || 1));
        await this._hass.callService('menstruation_gauge', 'manage_household_inventory', {
          inventory_action: 'add_to_shopping_list',
          product: 'underwear',
          quantity,
        });
      });
    });

    const nameInput = root.getElementById('patient-name');
    if (nameInput) {
      nameInput.addEventListener('input', e => { this._patientName = e.target.value; });
    }
    const bdInput = root.getElementById('patient-birthdate');
    if (bdInput) {
      bdInput.addEventListener('input', e => { this._patientBirthdate = e.target.value; });
    }
    const langSelect = root.getElementById('export-lang');
    if (langSelect) {
      langSelect.addEventListener('change', e => { this._exportLanguage = e.target.value; });
    }

    const exportBtn = root.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        if (this._exportStatus === 'loading') return;
        this._exportStatus = 'loading';
        this._render();
        try {
          const serviceData = {
            days_back: this._daysBack,
            language: this._exportLanguage || this._lang(),
          };
          if (this._config.entity) serviceData.entity_id = this._config.entity;
          if (this._config.entry_id) serviceData.entry_id = this._config.entry_id;
          if (this._config.profile) serviceData.profile = this._config.profile;
          const name = (root.getElementById('patient-name') || { value: this._patientName }).value.trim();
          const bd = (root.getElementById('patient-birthdate') || { value: this._patientBirthdate }).value.trim();
          const lang = (root.getElementById('export-lang') || { value: this._exportLanguage || this._lang() }).value;
          if (name) serviceData.patient_name = name;
          if (bd) serviceData.patient_birthdate = bd;
          serviceData.language = lang;

          await this._hass.callService('menstruation_gauge', 'export_doctor_report', serviceData);
          this._exportStatus = 'ok';
        } catch (err) {
          console.error('export_doctor_report failed', err);
          this._exportStatus = 'err';
        }
        this._render();
      });
    }
  }
}

customElements.define('menstruation-statistics-card', MenstruationStatisticsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-statistics-card',
  name: 'Menstruation Statistics Card',
  description: 'Displays menstrual cycle statistics and generates a doctor report.',
  preview: false,
  documentationURL: 'https://github.com/wallenium/HA-menstrual-gauge-v2',
});

// Expose hygiene helpers for testing (no external dependency on shared module)
MenstruationStatisticsCard._hygieneHelpers = {
  DEFAULT_CONFIG,
  HYGIENE_TRANSLATIONS,
  mergeConfig,
  getLang,
  translate,
  escapeHtml,
  escapeClassName,
  normalizeQuantity,
  normalizeProductKey,
  normalizeDateKey,
  dateKeyToOrdinal,
  todayOrdinal,
  formatNumber,
  dateLocale,
  formatDate,
  getSvgIcon,
  getUsageData,
  calculateStats,
  calculateAverageDailyUsage,
  calculateUnderwearWashPlan,
  calculateCupSavings,
  productLabel,
  buildMetrics,
  renderTimeline,
  getHygieneStyles,
  renderHygieneContent,
};
