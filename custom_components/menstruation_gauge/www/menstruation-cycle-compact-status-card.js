class MenstruationCycleCompactStatusCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstruation-cycle-compact-status',
      entity: 'sensor.menstruation',
      entry_id: '',
      title: '',
      show_title: false,
    };
  }

  static getConfigElement() {
    return document.createElement('menstruation-cycle-compact-status-editor');
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      show_title: false,
      ...config,
    };
    this._ensureRoot();
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    return 2;
  }

  _ensureRoot() {
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
  }

  _lang() {
    const language = String(this._hass?.locale?.language || this._hass?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        entity_not_found: 'Entity nicht gefunden',
        unknown: 'Unbekannt',
        title: 'Zyklus Status',
        cycle_day: 'Zyklustag',
        period: 'Periode',
        fertile: 'Fruchtbar',
        ovulation: 'Eisprung',
        pms: 'PMS',
        neutral: 'Neutral',
        pre_menarche: 'Vor Menarche',
        pregnant: 'Schwangerschaft',
        postpartum: 'Wochenbett',
        menarche: 'Menarche',
        menopause: 'Menopause',
        in_menopause: 'In Menopause',
        week: 'Woche',
        day: 'Tag',
        of: 'von',
        due_date: 'Geburtstermin',
        estimated_date: 'Geschätzter Termin',
        days_until: 'Tage bis Menarche',
        progress: 'Fortschritt',
        postpartum_end: 'Ende Wochenbett',
        since: 'seit',
        years: 'Jahren',
        months: 'Monaten',
        phase_period: 'Blutung',
        phase_fertile: 'Fruchtbar',
        phase_ovulation: 'Eisprung',
        phase_pms: 'PMS',
        phase_neutral: 'Neutral',
        tt_product_usage: 'Produktverbrauch',
        tt_symptoms: 'Symptome',
        tt_no_data: 'Keine Zusatzdaten',
        tt_status_icon: 'Status-Icon',
        tt_tampon: 'Tampon',
        tt_pad: 'Binde',
        tt_cup: 'Menstruationstasse',
        tt_liner: 'Slipeinlage',
        tt_underwear: 'Periodenunterwäsche',
        tt_bleeding: 'Blutung',
        tt_mood: 'Stimmung',
        tt_pain: 'Schmerzen',
        tt_spotting: 'Schmierblutung',
        tt_cervical_mucus: 'Zervixschleim',
        tt_intercourse: 'Geschlechtsverkehr',
        tt_hygiene: 'Hygiene',
      },
      en: {
        entity_not_found: 'Entity not found',
        unknown: 'Unknown',
        title: 'Cycle Status',
        cycle_day: 'Cycle Day',
        period: 'Period',
        fertile: 'Fertile',
        ovulation: 'Ovulation',
        pms: 'PMS',
        neutral: 'Neutral',
        pre_menarche: 'Pre-Menarche',
        pregnant: 'Pregnancy',
        postpartum: 'Postpartum',
        menarche: 'Menarche',
        menopause: 'Menopause',
        in_menopause: 'In Menopause',
        week: 'Week',
        day: 'Day',
        of: 'of',
        due_date: 'Due Date',
        estimated_date: 'Estimated Date',
        days_until: 'Days until Menarche',
        progress: 'Progress',
        postpartum_end: 'Postpartum End',
        since: 'since',
        years: 'years',
        months: 'months',
        phase_period: 'Bleeding',
        phase_fertile: 'Fertile',
        phase_ovulation: 'Ovulation',
        phase_pms: 'PMS',
        phase_neutral: 'Neutral',
        tt_product_usage: 'Product Usage',
        tt_symptoms: 'Symptoms',
        tt_no_data: 'No additional data',
        tt_status_icon: 'Status icon',
        tt_tampon: 'Tampon',
        tt_pad: 'Pad',
        tt_cup: 'Menstrual Cup',
        tt_liner: 'Liner',
        tt_underwear: 'Period Underwear',
        tt_bleeding: 'Bleeding',
        tt_mood: 'Mood',
        tt_pain: 'Pain',
        tt_spotting: 'Spotting',
        tt_cervical_mucus: 'Cervical Mucus',
        tt_intercourse: 'Intercourse',
        tt_hygiene: 'Hygiene',
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
  }

  _resolveEntityId() {
    const states = this._hass?.states || {};
    const configuredEntity = String(this._config?.entity || '').trim();
    if (configuredEntity && states[configuredEntity]) return configuredEntity;

    const targetEntryId = String(this._config?.entry_id || '').trim();
    if (targetEntryId) {
      const match = Object.keys(states).find((entityId) => {
        const st = states[entityId];
        return st?.attributes?.entry_id === targetEntryId;
      });
      if (match) return match;
    }

    return configuredEntity || null;
  }

  _normalizeISO(value) {
    const match = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  _todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _calcCycleDay(attrs) {
    const cycleLength = Math.max(1, parseInt(String(attrs.avg_cycle_length || '28'), 10) || 28);
    const hasDaysUntil = attrs.days_until_next_start !== null
      && attrs.days_until_next_start !== undefined
      && String(attrs.days_until_next_start).trim() !== '';
    const daysUntilStart = hasDaysUntil ? parseInt(String(attrs.days_until_next_start), 10) : NaN;
    if (Number.isFinite(daysUntilStart)) {
      return {
        cycleDay: Math.min(cycleLength, Math.max(1, cycleLength - daysUntilStart)),
        cycleLength,
      };
    }

    const nextStartRaw = attrs.next_predicted_start;
    if (nextStartRaw) {
      const today = new Date();
      const nextDate = new Date(nextStartRaw);
      if (!Number.isNaN(nextDate.getTime())) {
        today.setHours(0, 0, 0, 0);
        nextDate.setHours(0, 0, 0, 0);
        const daysUntil = Math.ceil((nextDate - today) / 86400000);
        return {
          cycleDay: Math.min(cycleLength, Math.max(1, cycleLength - daysUntil)),
          cycleLength,
        };
      }
    }

    return { cycleDay: 1, cycleLength };
  }

  _resolveStatus(stateObj) {
    const attrs = stateObj?.attributes || {};
    const todayIso = this._todayISO();
    const ovulationIso = this._normalizeISO(attrs.ovulation_day);

    if (attrs.is_pregnant || stateObj?.state === 'pregnant') return 'pregnant';
    if (attrs.is_postpartum || stateObj?.state === 'postpartum') return 'postpartum';
    if (attrs.awaiting_menarche || stateObj?.state === 'pre_menarche') return 'pre_menarche';
    if (stateObj?.state === 'fertile' && ovulationIso && ovulationIso === todayIso) return 'ovulation';
    return stateObj?.state || 'neutral';
  }

  _statusMeta(statusKey) {
    const map = {
      period: { color: 'var(--error-color, #e74c3c)', label: this._t('period'), icon: 'drop' },
      pms: { color: 'var(--warning-color, #f39c12)', label: this._t('pms'), icon: 'warning' },
      fertile: { color: 'var(--success-color, #27ae60)', label: this._t('fertile'), icon: 'heart' },
      ovulation: { color: 'var(--warning-color, #f39c12)', label: this._t('ovulation'), icon: 'ovulation' },
      neutral: { color: 'var(--secondary-text-color, #95a5a6)', label: this._t('neutral'), icon: 'dash' },
      pre_menarche: { color: 'var(--primary-color, #9b59b6)', label: this._t('pre_menarche'), icon: 'flower' },
      pregnant: { color: 'var(--state-icon-color, #3498db)', label: this._t('pregnant'), icon: 'pregnant' },
      postpartum: { color: 'var(--state-icon-color, #1abc9c)', label: this._t('postpartum'), icon: 'baby' },
      menarche: { color: 'var(--primary-color, #9b59b6)', label: this._t('menarche'), icon: 'flower' },
      menopause: { color: 'var(--secondary-text-color, #34495e)', label: this._t('menopause'), icon: 'moon' },
    };
    return map[statusKey] || map.neutral;
  }

  _statusIcon(statusKey, color, attrs, size = 'default') {
    const iconMarkup = window.ProductIcons?.getStatusAnimatedIcon?.(statusKey, attrs, size);
    if (!iconMarkup) {
      return '<svg viewBox="0 0 24 24" role="img" aria-hidden="true" focusable="false"><path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    }
    return iconMarkup;
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _buildTooltipContent(attrs) {
    const sections = [];

    // --- Product usage section ---
    const productUsage = attrs.product_usage_today;
    if (productUsage && typeof productUsage === 'object') {
      const products = ['tampon', 'pad', 'cup', 'liner', 'underwear'];
      const usedProducts = products.filter((p) => Number(productUsage[p] || 0) > 0);
      if (usedProducts.length > 0) {
        const rows = usedProducts.map((p) => `<div class="tt-row"><span class="tt-key">${this._t(`tt_${p}`)}</span><span class="tt-val">${Number(productUsage[p])}</span></div>`).join('');
        sections.push(`<div class="tt-section"><div class="tt-heading">${this._t('tt_product_usage')}</div>${rows}</div>`);
      }
    }

    // --- Symptom data section ---
    const symptomData = attrs.symptom_data_today;
    if (symptomData && typeof symptomData === 'object') {
      const symptomKeyMap = [
        ['bleeding_strength', 'tt_bleeding'],
        ['mood', 'tt_mood'],
        ['pain_types', 'tt_pain'],
        ['spotting', 'tt_spotting'],
        ['cervical_mucus', 'tt_cervical_mucus'],
        ['hygiene', 'tt_hygiene'],
        ['intercourse', 'tt_intercourse'],
      ];
      const rows = [];
      for (const [dataKey, i18nKey] of symptomKeyMap) {
        const val = symptomData[dataKey];
        if (val == null || val === '' || (Array.isArray(val) && val.length === 0)) continue;
        const display = Array.isArray(val)
          ? val.map((v) => this._escapeHtml(v)).join(', ')
          : this._escapeHtml(val);
        rows.push(`<div class="tt-row"><span class="tt-key">${this._t(i18nKey)}</span><span class="tt-val">${display}</span></div>`);
      }
      if (rows.length > 0) {
        sections.push(`<div class="tt-section"><div class="tt-heading">${this._t('tt_symptoms')}</div>${rows.join('')}</div>`);
      }
    }

    if (sections.length === 0) {
      return `<div class="tt-empty">${this._t('tt_no_data')}</div>`;
    }

    return sections.join('');
  }

  // Build the SVG cycle phase circle with colored sectors for cycle modes
  _buildCycleCircle(cycleDay, cycleLength, attrs) {
    const periodDays = Math.max(1, parseInt(String(attrs.period_duration_days || '5'), 10) || 5);
    const fertileStart = attrs.fertile_window_start
      ? this._dayOfCycleFromISO(attrs.fertile_window_start, attrs)
      : 10;
    const fertileEnd = attrs.fertile_window_end
      ? this._dayOfCycleFromISO(attrs.fertile_window_end, attrs)
      : 16;
    const ovulationDay = attrs.ovulation_day
      ? this._dayOfCycleFromISO(attrs.ovulation_day, attrs)
      : 14;
    // PMS: last 3-5 days before period
    const pmsStart = Math.max(1, cycleLength - 4);
    const pmsEnd = cycleLength;

    const cx = 40;
    const cy = 40;
    const outerR = 34;
    const innerR = 20;
    const TWO_PI = 2 * Math.PI;

    const arc = (day, r) => {
      const angle = ((day - 1) / cycleLength) * TWO_PI - Math.PI / 2;
      return {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    };

    let sectors = '';
    for (let day = 1; day <= cycleLength; day++) {
      const startAngle = ((day - 1) / cycleLength) * TWO_PI - Math.PI / 2;
      const endAngle = (day / cycleLength) * TWO_PI - Math.PI / 2;
      const gap = 0.03; // small gap between segments in radians

      const x1 = cx + innerR * Math.cos(startAngle + gap);
      const y1 = cy + innerR * Math.sin(startAngle + gap);
      const x2 = cx + outerR * Math.cos(startAngle + gap);
      const y2 = cy + outerR * Math.sin(startAngle + gap);
      const x3 = cx + outerR * Math.cos(endAngle - gap);
      const y3 = cy + outerR * Math.sin(endAngle - gap);
      const x4 = cx + innerR * Math.cos(endAngle - gap);
      const y4 = cy + innerR * Math.sin(endAngle - gap);

      let fill = 'var(--secondary-text-color, #95a5a6)'; // neutral
      if (day <= periodDays) {
        fill = 'var(--error-color, #e74c3c)'; // period
      } else if (day >= pmsStart && day <= pmsEnd) {
        fill = 'var(--warning-color, #f39c12)'; // pms
      } else if (day === ovulationDay) {
        fill = 'var(--warning-color, #e67e22)'; // ovulation
      } else if (day >= fertileStart && day <= fertileEnd) {
        fill = 'var(--success-color, #27ae60)'; // fertile
      }

      const isCurrent = day === cycleDay;
      const opacity = isCurrent ? '1' : '0.55';
      const strokeExtra = isCurrent ? ` stroke="var(--primary-text-color)" stroke-width="1.2"` : '';

      sectors += `<path d="M ${x1} ${y1} L ${x2} ${y2} A ${outerR} ${outerR} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${innerR} ${innerR} 0 0 0 ${x1} ${y1} Z" fill="${fill}" opacity="${opacity}"${strokeExtra}/>`;
    }

    // Animated marker dot for current day
    const markerAngle = ((cycleDay - 0.5) / cycleLength) * TWO_PI - Math.PI / 2;
    const markerR = (outerR + innerR) / 2;
    const mx = cx + markerR * Math.cos(markerAngle);
    const my = cy + markerR * Math.sin(markerAngle);

    return `<svg viewBox="0 0 80 80" role="img" aria-hidden="true" focusable="false" class="phase-circle">
      <g>${sectors}</g>
      <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="var(--ha-card-background, var(--card-background-color))"/>
      <text x="${cx}" y="${cy - 4}" class="day-num">${cycleDay}</text>
      <text x="${cx}" y="${cy + 9}" class="day-total">/${cycleLength}</text>
      <circle cx="${mx.toFixed(2)}" cy="${my.toFixed(2)}" r="3" fill="var(--primary-text-color)" class="marker-dot"/>
    </svg>`;
  }

  _dayOfCycleFromISO(isoStr, attrs) {
    const normalized = this._normalizeISO(isoStr);
    if (!normalized) return null;
    const nextStartRaw = attrs.next_predicted_start;
    if (!nextStartRaw) return null;
    try {
      const cycleLength = Math.max(1, parseInt(String(attrs.avg_cycle_length || '28'), 10) || 28);
      const nextDate = new Date(nextStartRaw);
      const targetDate = new Date(normalized);
      if (Number.isNaN(nextDate.getTime()) || Number.isNaN(targetDate.getTime())) return null;
      nextDate.setHours(0, 0, 0, 0);
      targetDate.setHours(0, 0, 0, 0);
      const daysUntilNext = Math.round((nextDate - targetDate) / 86400000);
      return Math.max(1, Math.min(cycleLength, cycleLength - daysUntilNext));
    } catch (_e) {
      return null;
    }
  }

  // Build the progress bar layout for pregnant / pre_menarche modes
  _buildProgressLayout(statusKey, attrs, status) {
    let iconMarkup = '';
    let titleText = '';
    let progressPercent = 0;
    let progressLabel = '';
    let progressColor = status.color;
    let subtitleText = '';

    if (statusKey === 'pregnant') {
      const weeksRaw = attrs.weeks_pregnant !== undefined ? attrs.weeks_pregnant : attrs.pregnancy_week;
      const weeksPregnant = Math.max(0, parseInt(String(weeksRaw || '0'), 10) || 0);
      iconMarkup = window.ProductIcons?.getPregnancyIcon?.(weeksPregnant, 'default') || this._statusIcon(statusKey, status.color, attrs);
      const totalWeeks = 40;
      progressPercent = Math.min(100, Math.round((weeksPregnant / totalWeeks) * 100));
      titleText = `${this._t('pregnant')} – ${this._t('week')} ${weeksPregnant}/${totalWeeks}`;
      progressLabel = `${progressPercent}%`;
      progressColor = 'var(--state-icon-color, #3498db)';

      const dueDateRaw = attrs.due_date;
      const dueDateNorm = this._normalizeISO(dueDateRaw);
      if (dueDateNorm) {
        subtitleText = `${this._t('due_date')}: ${dueDateNorm}`;
      }
    } else if (statusKey === 'pre_menarche') {
      iconMarkup = window.ProductIcons?.getStateIcon?.('pre_menarche', 'default') || this._statusIcon(statusKey, status.color, attrs);
      const menarcheData = attrs.menarche_data || {};
      const daysUntil = attrs.days_until_menarche !== undefined ? parseInt(String(attrs.days_until_menarche || '0'), 10) : null;
      const estimatedDate = this._normalizeISO(menarcheData.estimated_date || attrs.estimated_menarche_date);

      // Calculate progress: use days_until_menarche relative to a rough window
      // If we have estimated date, compute percent of time elapsed
      if (estimatedDate) {
        const today = new Date();
        const estimated = new Date(estimatedDate);
        today.setHours(0, 0, 0, 0);
        estimated.setHours(0, 0, 0, 0);
        const daysLeft = Math.ceil((estimated - today) / 86400000);
        // Assume tracking started ~2 years before estimated menarche (~730 days)
        const trackingWindow = 730;
        const elapsed = Math.max(0, trackingWindow - daysLeft);
        progressPercent = Math.min(100, Math.round((elapsed / trackingWindow) * 100));
        subtitleText = `${this._t('estimated_date')}: ${estimatedDate}`;
      } else if (daysUntil !== null && Number.isFinite(daysUntil)) {
        const trackingWindow = 730;
        const elapsed = Math.max(0, trackingWindow - Math.max(0, daysUntil));
        progressPercent = Math.min(100, Math.round((elapsed / trackingWindow) * 100));
        subtitleText = `${this._t('days_until')}: ${Math.max(0, daysUntil)}`;
      } else {
        progressPercent = 0;
      }

      titleText = this._t('pre_menarche');
      progressLabel = `${progressPercent}%`;
      progressColor = 'var(--primary-color, #9b59b6)';
    } else if (statusKey === 'postpartum') {
      iconMarkup = window.ProductIcons?.getPostpartumIcon?.('default') || this._statusIcon(statusKey, status.color, attrs);
      const birthDateNorm = this._normalizeISO(attrs.birth_date);
      const postpartumDuration = Math.max(1, parseInt(String(attrs.postpartum_duration || '42'), 10) || 42);

      let daysSinceBirth = 0;
      if (birthDateNorm) {
        const today = new Date();
        const birthDate = new Date(birthDateNorm);
        today.setHours(0, 0, 0, 0);
        birthDate.setHours(0, 0, 0, 0);
        daysSinceBirth = Math.max(0, Math.round((today - birthDate) / 86400000));
      }
      daysSinceBirth = Math.min(daysSinceBirth, postpartumDuration);
      progressPercent = Math.min(100, Math.round((daysSinceBirth / postpartumDuration) * 100));
      progressColor = 'var(--state-icon-color, #1abc9c)';

      if (postpartumDuration % 7 === 0) {
        const weeksTotal = postpartumDuration / 7;
        const weeksCurrent = Math.floor(daysSinceBirth / 7);
        titleText = `${this._t('postpartum')} – ${this._t('week')} ${weeksCurrent}/${weeksTotal}`;
      } else {
        titleText = `${this._t('postpartum')} – ${this._t('day')} ${daysSinceBirth}/${postpartumDuration}`;
      }
      progressLabel = `${progressPercent}%`;

      if (birthDateNorm) {
        const endDate = new Date(birthDateNorm);
        endDate.setHours(0, 0, 0, 0);
        endDate.setDate(endDate.getDate() + postpartumDuration);
        const endY = endDate.getFullYear();
        const endM = String(endDate.getMonth() + 1).padStart(2, '0');
        const endD = String(endDate.getDate()).padStart(2, '0');
        subtitleText = `${this._t('postpartum_end')}: ${endY}-${endM}-${endD}`;
      }
    }

    return `
      <div class="progress-layout">
        <div class="progress-header">
          <span class="progress-icon" role="img" aria-hidden="true">${iconMarkup}</span>
          <div class="progress-title-wrap">
            <div class="progress-title">${titleText}</div>
            ${subtitleText ? `<div class="progress-subtitle">${subtitleText}</div>` : ''}
          </div>
        </div>
        <div class="progress-bar-wrap" aria-label="${this._t('progress')} ${progressLabel}">
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width:${progressPercent}%;background:${progressColor};"></div>
          </div>
          <span class="progress-pct">${progressLabel}</span>
        </div>
      </div>
    `;
  }

  // Build simple icon + text layout for menarche, menopause
  _buildIconTextLayout(statusKey, status, attrs) {
    const iconMarkup = window.ProductIcons?.getStatusAnimatedIcon?.(statusKey, attrs, 'default')
      || this._statusIcon(statusKey, status.color, attrs);

    let extraInfo = '';
    if (statusKey === 'menopause') {
      const menopauseStartNorm = this._normalizeISO(attrs.menopause_start_date);
      if (menopauseStartNorm) {
        const today = new Date();
        const startDate = new Date(menopauseStartNorm);
        today.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        const totalMonths = Math.floor((today - startDate) / (1000 * 60 * 60 * 24 * 30.44));
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        if (years > 0) {
          extraInfo = `${this._t('since')} ${years} ${this._t('years')}`;
        } else if (months > 0) {
          extraInfo = `${this._t('since')} ${months} ${this._t('months')}`;
        }
      }
    }

    const titleLabel = statusKey === 'menopause' ? this._t('in_menopause') : status.label;

    return `
      <div class="icon-text-layout">
        <span class="big-icon" role="img" aria-hidden="true">${iconMarkup}</span>
        <div class="icon-text-info">
          <div class="icon-text-title" style="color:${status.color};">${titleLabel}</div>
          ${extraInfo ? `<div class="icon-text-sub">${extraInfo}</div>` : ''}
        </div>
      </div>
    `;
  }

  _render() {
    this._ensureRoot();
    if (!this._config || !this.shadowRoot) return;

    const entityId = this._resolveEntityId();
    const stateObj = entityId ? this._hass?.states?.[entityId] : undefined;
    if (!stateObj) {
      this.shadowRoot.innerHTML = `<ha-card><div class="empty">${this._t('entity_not_found')}</div></ha-card>`;
      return;
    }

    const attrs = stateObj.attributes || {};
    const { cycleDay, cycleLength } = this._calcCycleDay(attrs);
    const statusKey = this._resolveStatus(stateObj);
    const status = this._statusMeta(statusKey);

    // Determine rendering mode
    const CYCLE_MODES = ['period', 'pms', 'fertile', 'ovulation', 'neutral'];
    const PROGRESS_MODES = ['pregnant', 'pre_menarche', 'postpartum'];
    const ICON_TEXT_MODES = ['menarche', 'menopause'];

    let bodyHtml = '';

    if (CYCLE_MODES.includes(statusKey)) {
      // Mode 1: Cycle circle (left) | info text (centre) | status icon with tooltip (right)
      const circleHtml = this._buildCycleCircle(cycleDay, cycleLength, attrs);
      const tooltipHtml = this._buildTooltipContent(attrs);
      bodyHtml = `
        <div class="wrap">
          <div class="circle-wrap">${circleHtml}</div>
          <div class="info">
            <div class="status-text">${status.label}</div>
            <div class="cycle-day">${this._t('cycle_day')} ${cycleDay}/${cycleLength}</div>
          </div>
          <div class="icon-right-wrap">
            <button class="icon-right-btn" style="border-color:${status.color};color:${status.color};" aria-label="${this._t('tt_status_icon')}: ${status.label}" aria-describedby="status-tooltip" tabindex="0">
              ${this._statusIcon(statusKey, status.color, attrs, 'default')}
            </button>
            <div class="icon-tooltip" role="tooltip" id="status-tooltip">${tooltipHtml}</div>
          </div>
        </div>
      `;
    } else if (PROGRESS_MODES.includes(statusKey)) {
      // Mode 2/3: Progress bar layout
      bodyHtml = this._buildProgressLayout(statusKey, attrs, status);
    } else if (ICON_TEXT_MODES.includes(statusKey)) {
      // Mode 4: Icon + text only
      bodyHtml = this._buildIconTextLayout(statusKey, status, attrs);
    } else {
      // Fallback: cycle mode display
      const circleHtml = this._buildCycleCircle(cycleDay, cycleLength, attrs);
      const tooltipHtml = this._buildTooltipContent(attrs);
      bodyHtml = `
        <div class="wrap">
          <div class="circle-wrap">${circleHtml}</div>
          <div class="info">
            <div class="status-text">${status.label}</div>
            <div class="cycle-day">${this._t('cycle_day')} ${cycleDay}/${cycleLength}</div>
          </div>
          <div class="icon-right-wrap">
            <button class="icon-right-btn" style="border-color:${status.color};color:${status.color};" aria-label="${this._t('tt_status_icon')}: ${status.label}" aria-describedby="status-tooltip" tabindex="0">
              ${this._statusIcon(statusKey, status.color, attrs, 'default')}
            </button>
            <div class="icon-tooltip" role="tooltip" id="status-tooltip">${tooltipHtml}</div>
          </div>
        </div>
      `;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          --mg-card-bg: var(--ha-card-background, var(--card-background-color, #fff));
          --mg-border: var(--divider-color, rgba(127, 127, 127, 0.35));
        }
        ha-card { padding: 10px 12px; background: var(--mg-card-bg); border: 1px solid var(--mg-border); }
        .title { color: var(--secondary-text-color); font-size: 0.78rem; margin: 0 0 6px; }
        .empty { padding: 12px; color: var(--secondary-text-color); }

        /* === Cycle circle mode === */
        .wrap { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .circle-wrap { width: clamp(64px, 22vw, 80px); height: clamp(64px, 22vw, 80px); flex: 0 0 auto; }
        .phase-circle { width: 100%; height: 100%; display: block; }
        .day-num { text-anchor: middle; dominant-baseline: central; font-size: 9px; font-weight: 700; fill: var(--primary-text-color); }
        .day-total { text-anchor: middle; dominant-baseline: central; font-size: 7px; fill: var(--secondary-text-color); }
        .marker-dot { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse {
          0%, 100% { opacity: 1; r: 3; }
          50% { opacity: 0.6; r: 2.2; }
        }
        .info { min-width: 0; flex: 1; display: grid; gap: 4px; }
        .status-text { font-size: 0.95rem; font-weight: 600; color: var(--primary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .cycle-day { color: var(--secondary-text-color); font-size: 0.82rem; }

        /* === Right status icon === */
        .icon-right-wrap {
          position: relative;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .icon-right-btn {
          width: clamp(64px, 22vw, 80px);
          height: clamp(64px, 22vw, 80px);
          border-radius: 50%;
          border: 2px solid;
          background: var(--ha-card-background, var(--card-background-color));
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          box-sizing: border-box;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .icon-right-btn:focus-visible {
          outline: 2px solid var(--primary-color, #3498db);
          outline-offset: 2px;
        }
        .icon-right-btn svg { width: 58%; height: 58%; display: block; }
        .icon-right-btn img { width: 58%; height: 58%; object-fit: contain; display: block; }

        /* === Tooltip === */
        .icon-tooltip {
          position: absolute;
          right: 0;
          bottom: calc(100% + 6px);
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border: 1px solid var(--divider-color, rgba(127,127,127,0.35));
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.78rem;
          min-width: 150px;
          max-width: 220px;
          z-index: 100;
          pointer-events: none;
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 150ms ease, transform 150ms ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          color: var(--primary-text-color);
          white-space: normal;
        }
        .icon-right-wrap:hover .icon-tooltip,
        .icon-right-wrap:focus-within .icon-tooltip {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        .tt-section { margin-bottom: 6px; }
        .tt-section:last-child { margin-bottom: 0; }
        .tt-heading {
          font-weight: 600;
          font-size: 0.70rem;
          color: var(--secondary-text-color);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 3px;
        }
        .tt-row { display: flex; justify-content: space-between; gap: 8px; line-height: 1.4; }
        .tt-key { color: var(--secondary-text-color); }
        .tt-val { font-weight: 500; color: var(--primary-text-color); text-align: right; }
        .tt-empty { color: var(--secondary-text-color); font-style: italic; }

        /* === Progress bar mode === */
        .progress-layout { display: flex; flex-direction: column; gap: 8px; }
        .progress-header { display: flex; align-items: center; gap: 10px; }
        .progress-icon { width: 34px; height: 34px; line-height: 1; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; }
        .progress-icon svg { width: 100%; height: 100%; display: block; }
        .progress-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .progress-title-wrap { min-width: 0; flex: 1; }
        .progress-title { font-size: 0.92rem; font-weight: 600; color: var(--primary-text-color); }
        .progress-subtitle { font-size: 0.78rem; color: var(--secondary-text-color); margin-top: 2px; }
        .progress-bar-wrap { display: flex; align-items: center; gap: 8px; }
        .progress-bar-track { flex: 1; height: 8px; border-radius: 4px; background: var(--divider-color, rgba(127,127,127,0.25)); overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 4px; transition: width 400ms ease; min-width: 4px; }
        .progress-pct { font-size: 0.78rem; font-weight: 600; color: var(--secondary-text-color); white-space: nowrap; }

        /* === Icon + text mode === */
        .icon-text-layout { display: flex; align-items: center; gap: 12px; }
        .big-icon { width: 38px; height: 38px; line-height: 1; flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; }
        .big-icon svg { width: 100%; height: 100%; display: block; }
        .big-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .icon-text-info { min-width: 0; }
        .icon-text-title { font-size: 1rem; font-weight: 600; }
        .icon-text-sub { font-size: 0.8rem; color: var(--secondary-text-color); margin-top: 2px; }

        @media (prefers-color-scheme: dark) {
          .icon-right-btn {
            background: color-mix(in srgb, var(--mg-card-bg) 84%, #000 16%);
            border-color: color-mix(in srgb, currentColor 55%, var(--mg-border));
          }
          .progress-bar-track { background: color-mix(in srgb, var(--mg-border) 70%, transparent); }
          .icon-tooltip { box-shadow: 0 2px 8px rgba(0,0,0,0.4); }
        }

        @media (max-width: 380px) {
          ha-card { padding: 8px 10px; }
          .wrap { gap: 8px; }
          .status-text { font-size: 0.9rem; }
          .cycle-day { font-size: 0.76rem; }
          .progress-icon { width: 28px; height: 28px; }
          .big-icon { width: 32px; height: 32px; }
          .icon-tooltip { max-width: 180px; font-size: 0.74rem; }
        }
      </style>
      <ha-card>
        ${this._config.show_title ? `<div class="title">${this._config.title || this._t('title')}</div>` : ''}
        ${bodyHtml}
      </ha-card>
    `;
  }
}

class MenstruationCycleCompactStatusEditor extends HTMLElement {
  setConfig(config) {
    this._config = {
      show_title: false,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _lang() {
    const language = String(this._hass?.locale?.language || this._hass?.language || 'en').toLowerCase();
    return language.startsWith('de') ? 'de' : 'en';
  }

  _t(key) {
    const i18n = {
      de: {
        entity: 'Entität',
        title: 'Titel',
        show_title: 'Titel anzeigen',
      },
      en: {
        entity: 'Entity',
        title: 'Title',
        show_title: 'Show title',
      },
    };
    return (i18n[this._lang()] && i18n[this._lang()][key]) || (i18n.en[key] || key);
  }

  _emit(nextConfig) {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: nextConfig },
      bubbles: true,
      composed: true,
    }));
  }

  _render() {
    if (!this._config) return;
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });

    this.shadowRoot.innerHTML = `
      <style>
        .wrap { display: grid; gap: 10px; }
        .row { display: grid; gap: 4px; }
        label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color); }
        input[type='text'] {
          width: 100%;
          box-sizing: border-box;
          padding: 8px 10px;
          border: 1px solid var(--divider-color);
          border-radius: 8px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .check {
          display: flex;
          gap: 8px;
          align-items: center;
          color: var(--primary-text-color);
        }
      </style>
      <div class="wrap">
        <div class="row">
          <label for="entity">${this._t('entity')}</label>
          <input id="entity" type="text" value="${String(this._config.entity || '')}" placeholder="sensor.menstruation" />
        </div>
        <div class="row">
          <label for="title">${this._t('title')}</label>
          <input id="title" type="text" value="${String(this._config.title || '')}" />
        </div>
        <label class="check">
          <input id="show_title" type="checkbox" ${this._config.show_title ? 'checked' : ''} />
          <span>${this._t('show_title')}</span>
        </label>
      </div>
    `;

    const entityInput = this.shadowRoot.getElementById('entity');
    const titleInput = this.shadowRoot.getElementById('title');
    const showTitleInput = this.shadowRoot.getElementById('show_title');

    entityInput?.addEventListener('change', (ev) => {
      const value = String(ev.target?.value || '').trim();
      this._emit({ ...this._config, entity: value });
    });

    titleInput?.addEventListener('change', (ev) => {
      const value = String(ev.target?.value || '');
      this._emit({ ...this._config, title: value });
    });

    showTitleInput?.addEventListener('change', (ev) => {
      const checked = Boolean(ev.target?.checked);
      this._emit({ ...this._config, show_title: checked });
    });
  }
}

if (!customElements.get('menstruation-cycle-compact-status')) {
  customElements.define('menstruation-cycle-compact-status', MenstruationCycleCompactStatusCard);
}

if (!customElements.get('menstruation-cycle-compact-status-editor')) {
  customElements.define('menstruation-cycle-compact-status-editor', MenstruationCycleCompactStatusEditor);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstruation-cycle-compact-status',
  name: 'Menstruation Cycle Compact Status',
  description: 'Compact cycle status with circular day indicator and status icon',
});
