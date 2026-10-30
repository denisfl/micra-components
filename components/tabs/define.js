/*
 * components/tabs/define.js — Tabs (headless behavior).
 *
 * Pair with tabs.css (default skin) and theme/theme.css (tokens). The markup
 * renders the tablist and panels from state via data-each; this file owns the
 * behavior: selection, roving tabindex, arrow/Home/End keyboard, and automatic
 * activation (selecting a tab also moves real focus to it).
 *
 * Tabs are data-driven: state.tabs holds { id, label, body[, disabled] } and
 * state.selected is the selected tab id. Selection logic and the prev/next
 * lookups are methods, never state — state stays raw data only.
 *
 * Markup contract:
 *   <div data-component="tabs">
 *     <div role="tablist" @keydown.left.prevent="prev" …>
 *       <template data-each="tabs" data-key="id"> … role="tab" button … </template>
 *     </div>
 *     <template data-each="tabs" data-key="id"> … role="tabpanel" … </template>
 *   </div>
 */
Micra.define('tabs', {
  state: {
    tabs: [
      { id: 'account', label: 'Account', body: 'Manage your account details and sign-in.' },
      { id: 'password', label: 'Password', body: 'Change your password and review sessions.' },
      { id: 'team', label: 'Team', body: 'Invite teammates and set their roles.' },
    ],
    selected: '',
  },

  onCreate() {
    // Default selection: the first enabled tab. Done here, not as a state
    // literal, so a host can hand in tabs/selected and we still fall back well.
    if (!this.selectedTab()) this.state.selected = this.firstEnabledId();
  },

  // — selection ————————————————————————————————————————————————
  select(id) {
    const tab = this.state.tabs.find((t) => t.id === id);
    if (!tab || tab.disabled) return; // disabled tabs are not selectable
    this.state.selected = id;
    this.focusSelected();
  },

  prev() {
    this.select(this.adjacentEnabledId(-1));
  },

  next() {
    this.select(this.adjacentEnabledId(1));
  },

  first() {
    this.select(this.firstEnabledId());
  },

  last() {
    const enabled = this.enabledTabs();
    if (enabled.length) this.select(enabled[enabled.length - 1].id);
  },

  // — derived (methods, never state) ——————————————————————————————
  selectedTab() {
    return this.state.tabs.find((t) => t.id === this.state.selected);
  },

  enabledTabs() {
    return this.state.tabs.filter((t) => !t.disabled);
  },

  firstEnabledId() {
    const first = this.enabledTabs()[0];
    return first ? first.id : '';
  },

  // The enabled tab `step` positions away from the current one, wrapping. Walks
  // the full ring so we skip over any disabled tabs in between.
  adjacentEnabledId(step) {
    const tabs = this.state.tabs;
    const n = tabs.length;
    if (!n) return '';
    let i = tabs.findIndex((t) => t.id === this.state.selected);
    if (i < 0) i = 0;
    for (let hops = 0; hops < n; hops++) {
      i = (i + step + n) % n;
      if (!tabs[i].disabled) return tabs[i].id;
    }
    return this.state.selected; // all others disabled — stay put
  },

  // — focus ————————————————————————————————————————————————————
  // Automatic activation: after a selection re-renders, move real focus to the
  // newly selected tab button. We only query the DOM for the focus target — the
  // source of truth stays in state. tick() waits for the re-render (and the new
  // roving tabindex) before focus() runs.
  async focusSelected() {
    await this.tick();
    const tab = this.$el.querySelector('[role="tab"][aria-selected="true"]');
    if (tab) tab.focus();
  },
});
