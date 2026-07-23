/**
 * Menstrual Statistics Card
 * Displays cycle statistics in three modes:
 *   1. Statistiken (User statistics view)
 *   2. Arzt-Bericht (Doctor report + PDF export)
 *   3. Einstellungen (Settings)
 */
class MenstrualStatisticsCard extends HTMLElement {
  static getStubConfig() {
    return {
      type: 'custom:menstrual-statistics-card',
      entity: '',
      title: '',
      days_back: 180,
      language: 'auto',
    };
  }

  static getConfigElement() {
    return document.createElement('menstrual-statistics-card-editor');
  }

  setConfig(config) {
    if (!config || (!config.entity && !config.entry_id)) {
      throw new Error('entity or entry_id is required');
    }
    this._config = {
      title: '',
      days_back: 180,
      language: 'auto',
      ...config,
    };
    this._tab = this._tab || 'stats';
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
        tab_stats: 'Statistiken',
        tab_doctor: 'Arzt-Bericht',
        tab_settings: 'Einstellungen',
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
        tab_stats: 'Statistics',
        tab_doctor: 'Doctor Report',
        tab_settings: 'Settings',
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

  _computeStats(attrs) {
    if (!attrs) return null;
    const today = new Date();
    const cutoffMs = today.getTime() - this._daysBack * 86400000;
    const cutoffIso = new Date(cutoffMs).toISOString().slice(0, 10);

    // Raw history from sensor attributes
    const rawHistory = Array.isArray(attrs.history) ? attrs.history : [];
    const history = rawHistory.filter(d => d >= cutoffIso).sort();

    // Grouped cycle starts
    const rawStarts = Array.isArray(attrs.grouped_starts) ? attrs.grouped_starts : [];
    const starts = rawStarts.filter(d => d >= cutoffIso);

    // Cycle statistics from sensor
    const cycleStats = attrs.cycle_statistics || {};
    const symptomStats = attrs.symptom_statistics || {};
    const bleedingBlocks = Array.isArray(attrs.bleeding_blocks) ? attrs.bleeding_blocks : [];

    // Compute cycle lengths from starts within window
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

    // Bleeding duration from bleeding_blocks
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

    // Symptom data
    const symptomHistory = Array.isArray(attrs.symptom_history) ? attrs.symptom_history : [];
    const recentSymptoms = symptomHistory.filter(s => s.date >= cutoffIso);

    // Bleeding strength distribution
    const bsCount = {};
    for (const s of recentSymptoms) {
      const bs = s.bleeding_strength;
      if (bs) bsCount[bs] = (bsCount[bs] || 0) + 1;
    }
    const bsTotal = Object.values(bsCount).reduce((a, b) => a + b, 0);
    const bsDist = bsTotal > 0
      ? Object.entries(bsCount).map(([k, v]) => ({ key: k, pct: Math.round(v / bsTotal * 100) })).sort((a, b) => b.pct - a.pct)
      : [];

    // Top symptoms
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

    // Pain trend per cycle
    const cycleStarts = rawStarts.filter(d => d >= cutoffIso);
    const painTrend = cycleStarts.map((startIso, idx) => {
      const endIso = cycleStarts[idx + 1]
        ? (() => { const d = new Date(cycleStarts[idx + 1]); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })()
        : today.toISOString().slice(0, 10);
      const painDays = recentSymptoms.filter(s => s.date >= startIso && s.date <= endIso && (s.pain && (Array.isArray(s.pain) ? s.pain.length > 0 : true))).length;
      return { cycleStart: startIso, painDays };
    });

    return {
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

    // Cycle length
    const hasCycle = stats.cycleLengths.length > 0;
    const cycleHtml = hasCycle ? `
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${stats.avg}</div><div class="stat-key">${t('avg')} (${t('days')})</div></div>
        <div class="stat-box"><div class="stat-val">${stats.minLen}</div><div class="stat-key">${t('min')}</div></div>
        <div class="stat-box"><div class="stat-val">${stats.maxLen}</div><div class="stat-key">${t('max')}</div></div>
        <div class="stat-box"><div class="stat-val">±${stats.stdDev}</div><div class="stat-key">${t('std_dev')}</div></div>
      </div>` : `<div class="no-data">${t('no_cycle_data')}</div>`;

    const regularity = stats.regularity ? `<div class="regularity-badge reg-${esc(stats.regularity)}">${esc(t(stats.regularity))}</div>` : '';

    // Bleeding duration
    const bleedHtml = stats.avgBleed !== null ? `
      <div class="stat-grid">
        <div class="stat-box"><div class="stat-val">${stats.avgBleed}</div><div class="stat-key">${t('avg')} (${t('days')})</div></div>
        <div class="stat-box"><div class="stat-val">${stats.minBleed}</div><div class="stat-key">${t('min')}</div></div>
        <div class="stat-box"><div class="stat-val">${stats.maxBleed}</div><div class="stat-key">${t('max')}</div></div>
      </div>` : `<div class="no-data">${t('no_data')}</div>`;

    // Bleeding strength distribution
    const bsHtml = this._renderStatsBars(stats.bsDist, (k) => this._bsLabel(k));

    // Top symptoms
    const symHtml = this._renderStatsBars(stats.topSymptoms, (k) => this._symLabel(k));

    // Pain trend sparkline
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

  _renderSettingsTab() {
    const t = (k) => this._t(k);
    const options = [
      { value: 90, label: t('months_3') },
      { value: 180, label: t('months_6') },
      { value: 365, label: t('months_12') },
    ];
    return `
      <div class="section">
        <div class="section-header"><span class="section-icon">⚙️</span><span>${this._escHtml(t('settings_title'))}</span></div>
        <div class="form-field">
          <label>${this._escHtml(t('days_back_label'))}</label>
          <div class="days-buttons">
            ${options.map(o => `<button class="days-btn ${this._daysBack === o.value ? 'active' : ''}" data-days="${o.value}">${this._escHtml(o.label)}</button>`).join('')}
          </div>
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

    let tabContent = '';
    if (tab === 'stats') tabContent = this._renderStatsTab(stats);
    else if (tab === 'doctor') tabContent = this._renderDoctorTab();
    else if (tab === 'settings') tabContent = this._renderSettingsTab();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { padding: 12px 16px 16px; }
        .card-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--primary-text-color); }
        .tabs { display: flex; gap: 4px; margin-bottom: 16px; border-bottom: 2px solid var(--divider-color, #ddd); padding-bottom: 0; }
        .tab-btn { flex: 1; padding: 8px 4px; border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--secondary-text-color, #888); border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
        .tab-btn.active { color: var(--primary-color, #c0392b); border-bottom-color: var(--primary-color, #c0392b); }
        .tab-btn:hover:not(.active) { color: var(--primary-text-color); }
        .section { margin-bottom: 20px; }
        .section-header { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; margin-bottom: 8px; color: var(--primary-text-color); }
        .section-icon { font-size: 16px; }
        .section-meta { font-size: 11px; color: var(--secondary-text-color, #888); margin-bottom: 8px; }
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .stat-box { background: var(--secondary-background-color, #f5f5f5); border-radius: 8px; padding: 8px; text-align: center; }
        .stat-val { font-size: 18px; font-weight: 700; color: var(--primary-color, #c0392b); }
        .stat-key { font-size: 10px; color: var(--secondary-text-color, #888); margin-top: 2px; }
        .regularity-badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; margin-left: auto; }
        .reg-very_regular { background: #d5f5e3; color: #27ae60; }
        .reg-regular { background: #fef9e7; color: #f39c12; }
        .reg-irregular { background: #fdedec; color: #e74c3c; }
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
        .days-btn { flex: 1; padding: 8px; border: 1px solid var(--divider-color, #ddd); border-radius: 6px; background: var(--secondary-background-color, #f5f5f5); cursor: pointer; font-size: 12px; color: var(--primary-text-color); }
        .days-btn.active { background: var(--primary-color, #c0392b); color: #fff; border-color: var(--primary-color, #c0392b); }
        .empty { padding: 20px; text-align: center; color: var(--secondary-text-color, #888); }
      </style>
      <ha-card>
        ${title ? `<div class="card-title">${this._escHtml(title)}</div>` : ''}
        <div class="tabs">
          <button class="tab-btn ${tab === 'stats' ? 'active' : ''}" data-tab="stats">${this._escHtml(t('tab_stats'))}</button>
          <button class="tab-btn ${tab === 'doctor' ? 'active' : ''}" data-tab="doctor">${this._escHtml(t('tab_doctor'))}</button>
          <button class="tab-btn ${tab === 'settings' ? 'active' : ''}" data-tab="settings">${this._escHtml(t('tab_settings'))}</button>
        </div>
        <div class="tab-content">${tabContent}</div>
      </ha-card>`;

    this._attachListeners();
  }

  _attachListeners() {
    const root = this.shadowRoot;
    if (!root) return;

    // Tab switching
    root.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._tab = btn.dataset.tab;
        this._exportStatus = null;
        this._render();
      });
    });

    // Days buttons (settings tab)
    root.querySelectorAll('.days-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._daysBack = parseInt(btn.dataset.days, 10);
        this._render();
      });
    });

    // Doctor export form input persistence
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

    // Export button
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

customElements.define('menstrual-statistics-card', MenstrualStatisticsCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'menstrual-statistics-card',
  name: 'Menstrual Statistics Card',
  description: 'Displays menstrual cycle statistics and generates a doctor report.',
  preview: false,
  documentationURL: 'https://github.com/wallenium/HA-menstrual-gauge-v2',
});
