(function () {
  if (window.MenstruationHygieneShared) return;

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

  const TRANSLATIONS = {
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
    const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const value = dict[key];
    if (typeof value === 'function') return value(placeholders);
    return value ?? TRANSLATIONS.en[key] ?? key;
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

  function renderContent(hass, config, attrs) {
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

  function getStyles(options = {}) {
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

  function renderStandalone(hass, config, attrs) {
    const mergedConfig = mergeConfig(config);
    return `
      <style>${getStyles()}</style>
      <ha-card>
        <div class="mgp-header">
          <h2 class="mgp-title">${escapeHtml(mergedConfig.title || translate(hass, 'title'))}</h2>
          <p class="mgp-subtitle">${escapeHtml(attrs?.friendly_name || mergedConfig.entity || '')}</p>
        </div>
        <div class="mgp-content">${renderContent(hass, mergedConfig, attrs || {})}</div>
      </ha-card>`;
  }

  function renderEmbedded(hass, config, attrs) {
    return renderContent(hass, mergeConfig(config), attrs || {});
  }

  window.MenstruationHygieneShared = {
    DEFAULT_CONFIG,
    TRANSLATIONS,
    mergeConfig,
    translate,
    getLang,
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
    getStyles,
    renderStandalone,
    renderEmbedded,
  };
}());
