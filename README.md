## AI was used
AI (Codex) was used to help translate my own developed code from HTML/JavaScript to Python and YAML, and to help organize the Home Assistant repository for github.
AI also generated or improved some shell commands (mainly to save time).
The core idea and design were created by me (a human).
Text was drafted with AI support (mostly translation and structure), because English is not my native language and health-related wording is sensitive.

# HA Menstruation Gauge (HACS-ready) - development stage - testing only

This repository contains:
- a Home Assistant integration `menstruation_gauge` with multiple profiles/sensors
- services for cycle data management
- Lovelace custom cards for visualization and interaction



# How to setup:  Sorry, so many steps because of 2 parts: A) Integration + B) custom cards;
- Open HACS, add Custom repositories: git: /nremey/HA-menstrual-gauge-v2
- add in 'integration and services' new integration, search for "menstruation gauge"
- add user/friendly name and icon.
    -may add more users if more bleeding persons are in the household.
- restart HA; the integration registers its custom card resources automatically
- if a browser still shows an old frontend after an upgrade, refresh the browser cache once
- ready to add the custom card per user: with the menstruation-gauge-card 

- for daily recalculation of the remaining days, the user has to manually create an
  automation in Home Assistant that calls the service
  `menstruation_gauge.refresh_cycle_model` (example YAML is provided in `examples/`)

<img width="1016" height="431" alt="grafik" src="https://github.com/user-attachments/assets/6c516de7-4b1e-4c1c-aa3d-2e9d753a8987" />

<img width="1007" height="652" alt="menstruation-gauge-card.js" src="https://github.com/user-attachments/assets/0268362b-2b66-49ad-84bc-9879d40c280c" />




## Target Structure (GitHub)

```text
HA-menstruation-gauge-v2/
├── .github
│   ├── hacs.yml
│   └── hassfest.yml
├── hacs.json
├── README.md
├── DISCLAIMER.md
├── examples
│   └── daily_recalculate_days_until_next_start.yaml
└── custom_components/
    └── menstruation_gauge/
        ├── __init__.py
        ├── config_flow.py
        ├── const.py
        ├── manifest.json
        ├── model.py
        ├── sensor.py
        ├── services.yaml
        ├── storage.py
        ├── strings.json
        ├── translations/
        │   ├── de.json
        │   └── en.json
        └── www/
            ├── menstruation-gauge-card.js
            ├── menstruation-cycle-heatmap-card.js
            ├── period-countdown-timer.js
            └── menstrual-product-stats-card.js
```

## Why This Structure Is Required - Notes to myself to understand HACS requirements better.

1. `custom_components/menstruation_gauge/manifest.json`
- Required by Home Assistant so the integration domain can load.
- Without `manifest.json`, initialization fails.

2. `hacs.json`
- Required for proper HACS detection as a custom integration.
- Without it, HACS cannot reliably classify the repository.

3. `__init__.py`, `sensor.py`, `config_flow.py`
- `__init__.py` registers services and static card resources.
- `sensor.py` exposes state + attributes used by cards and automations.
- `config_flow.py` enables UI setup (no manual YAML integration setup required).

4. `storage.py`
- Persists history/settings in `.storage`.
- Without persistent storage, entered data is lost on restart.

5. `model.py`
- Keeps cycle calculation logic separated from HA framework code.
- Improves maintainability and traceability.

6. `www/*.js`
- Lovelace cards are JavaScript resources.
- Integration serves these files under `/menstruation_gauge/...`.

7. `services.yaml`
- Documents services in Home Assistant UI.
- Without it, services still work but are less discoverable.

## Functional Components

### Sensor
- Entity ID: one sensor per profile (e.g. `sensor.anna`, depending on entity registry)
- States: `period`, `fertile`, `pms`, `neutral`
- Attributes include:
  - `history`
  - `grouped_starts`
  - `bleeding_blocks`
  - `next_predicted_start`
  - `fertile_window_start`
  - `fertile_window_end`
  - `days_until_next_start` (can be negative when overdue)
  - `period_duration_days`
  - `period_duration_default_days`
  - `period_duration_learned_avg_days`

### Services
- `menstruation_gauge.add_cycle_start`
- `menstruation_gauge.remove_cycle_start`
- `menstruation_gauge.set_cycle_history`
- `menstruation_gauge.set_period_duration`
- `menstruation_gauge.erase_all_history` (destructive, requires `erase_all: true` and explicit `entity_id`)
- `menstruation_gauge.export_history` (export as `csv` or `txt`)
- `menstruation_gauge.refresh_cycle_model`
- `menstruation_gauge.log_product_usage`

For multi-profile setups, target by `entity_id` (recommended).

## Automation & Trigger Use (Assistive)

Sensor values can be used for assistive automations to make recurring PMS-related situations easier to handle.
This integration is intended to make personal patterns usable in practical, non-critical automations.

Examples:
- timed reminders for hygiene products
- proactive medication/supply reminders
- thermostat/room-climate adjustments for known freezing or heat episodes
- reminders for hydration, sleep routine, rest, meal prep, etc.

Guardrails:
- Assist, do not decide: do not use this as the sole source for safety-critical decisions.
- Personalize: use triggers only when they match your own symptom patterns.
- Mutual consent: in shared households, use automations only with explicit mutual agreement.

## step without HACS (manually) - tested , similar to HACS
- copy the folder /menstruation_gauge/ from github.com/nremey/HA-menstrual-gauge-v2/custom_components to /config/custom_components in HA.
- Add the customcards under `Settings -> Devices & Services` (...)-Menu "Add ressouces
    - `/menstruation_gauge/menstruation-gauge-card.js`
    - `/menstruation_gauge/menstruation-cycle-heatmap-card.js`
    - `/menstruation_gauge/period-countdown-timer.js`
    - `/menstruation_gauge/menstrual-product-stats-card.js`
- Type: `JavaScript module`
  
- restart HA
- clear cache
- Go to devices & integration -> add "Menstruation cauge", and than add a sensor per user.
- add a card: 
  - for interactive GUI and Input, use: custom:menstruation-gauge-card,
  - add Menstruation days (it is a click-interactive card, if allow new entries through calender is true)
  - if at least one cycle is added, maybe display menstrual-cycle-data with: custom:menstruation-cycle-heatmap-card (not interactive so far)


## Card Configuration Examples

### Gauge Card

```yaml
type: custom:menstruation-gauge-card
entity: sensor.anna
friendly_name: "Anna"
title: "Cycle of Anna"
period_duration_days: learnt  # or 1..14
show_editor: true
theme_mode: auto
show_fertile_period: true
calendar_edit_enabled: true
```

`period_duration_days` supports:
- number `1..14`
- `learnt` (fallbacks to sensor values if learned value is unavailable)

### Heatmap Card - little hint for the future:

<img width="1000" height="592" alt="menstruation-cycle-heatmap-card.js" src="https://github.com/user-attachments/assets/9b5759bd-f343-4640-b7cb-f79e4c6b0847" />

The heatmap card is already prepared for future symptom visualization.
The goal is to make recurring PMS-related patterns easier to spot visually and,
if useful, later support assistive automations around them.

Possible examples would be small icons on the day a symptom occurred,
such as nausea, heat episodes, freezing, or similar recurring symptoms.
Some symptoms may appear around similar day ranges after cycle start
or closer to cycle end. With top or bottom alignment, such patterns
can become easier to compare visually.

At the moment, the card-side preparation is there, but the corresponding
symptom sensors or data sources are not yet part of this integration.
Because of that, this part is not yet fully usable or tested in practice
and should currently be treated as experimental.

```yaml
type: custom:menstruation-cycle-heatmap-card
entity: sensor.anna
title: "Cycle Heatmap"
max_cycles: 18
period_duration_days: 5
show_fertile_period: true
cycle_alignment: bottom  # top | bottom
symptom_entities:
  - entity: sensor.anna_pms_nausea
    name: Nausea
    icon: mdi:emoticon-sick-outline
```
Sidenote: `symptom_entities` reflects the intended future direction of the
heatmap card. The card is prepared for it, but the related symptom data
sources are not yet implemented as part of this project.

### Product Countdown Timer

The timer card now supports direct product-consumption logging through the
`menstruation_gauge.log_product_usage` service. When the cycle state is
`neutral`, the timer is hidden and replaced with a "no products needed"
message. During `period`, `fertile`, and `pms`, users can log product usage
with one tap and restart the timer from the selected product duration.

```yaml
type: custom:period-countdown-timer
entity: sensor.anna
tampon_duration: 4
pad_duration: 4
cup_duration: 7
underwear_duration: 6
liner_duration: 8
```

### Product Usage Statistics Card

The statistics card uses the main menstruation sensor attributes to visualize:
- tampons per recent cycle
- pads per recent cycle
- menstrual cup empties per day for the last period
- planning days until the next predicted period
- a 30-day timeline with color-coded product usage

```yaml
type: custom:menstrual-product-stats-card
entity: sensor.anna
title: Product Usage
```

The repository also includes a combined dashboard example:
`examples/product_usage_dashboard.yaml`

## History Import Example

```yaml
service: menstruation_gauge.set_cycle_history
data:
  entity_id: sensor.anna
  dates:
    - "2026-01-14"
    - "2026-02-14"
```

## Safe History Deletion Example

```yaml
service: menstruation_gauge.erase_all_history
data:
  entity_id: sensor.anna
  erase_all: true
```

Notes:
- Requires `erase_all: true`.
- Requires explicit `entity_id` as additional safety barrier.
- Data recovery support after deletion cannot be provided.

## Export Example

```yaml
service: menstruation_gauge.export_history
data:
  entity_id: sensor.anna
  format: csv
  filename: cycle_backup
```

Target directory: `<config>/menstruation_gauge_exports/` 
- status: tested in browser (works), not tested yet within HA Companion app (needed to be checked).

## Product Usage Logging Example

```yaml
service: menstruation_gauge.log_product_usage
data:
  entity_id: sensor.anna
  product: tampon
  action: used
  quantity: 1
```

Additional sensors are created automatically per profile for use in dashboards
and automations:
- `*_tampon_usage_today`
- `*_pad_usage_today`
- `*_cup_empties_today`
- `*_product_usage_average_cycle`

## Medical and Safety Notice

See [DISCLAIMER.md](./DISCLAIMER.md).
This integration is an approximation and is not suitable as a reliable standalone method for contraception or conception planning.


## Usage Scope

This integration/cards is intended for visual pattern recognition only.
It is not designed for reliable automation logic, medical decisions, contraception, or conception planning.
Use it as an optical aid, not as a safety-critical decision system.


## New/Improved/Fixed
1. Improved: sensors for multiple persons can be created within the integration.
2. Not yet an issue, but likely relevant for future goals: naming conventions.
3. Added from suggestion: new dark theme option.
4. Fixed: title visibility within the card.
5. New: GUI editor for the custom gauge card.
6. New: heatmap card for long-term visualization.

## Feedback / Contributions

Feedback, ideas, suggestions, edge cases, wishes, experiences, or other possible
use cases are all welcome.

I am open to hearing about all of it, but I cannot promise that every request
will be implemented.

I am also very open to help from others, including suggestions for cleaner code,
better implementation approaches, additional visual cards, missing functions,
or other improvements that would make this project more useful.


Theme-examples:
<img width="494" height="779" alt="light-theme" src="https://github.com/user-attachments/assets/1ab5a772-8bcb-4936-aacf-fe19266a6a31" />
<img width="494" height="779" alt="dark-theme" src="https://github.com/user-attachments/assets/850b9750-fd2f-48fc-80b7-90cd182b4fe0" />
