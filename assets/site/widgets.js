(() => {
  function activate() {
    for (const widget of document.querySelectorAll('.paper-widget:not(.is-enhanced)')) {
      const field = widget.querySelector('.paper-widget-choice');
      const select = field.querySelector('select');
      const cases = Array.from(widget.querySelectorAll('.paper-widget-case'));
      const showCase = () => {
        for (const [index, panel] of cases.entries()) {
          panel.hidden = index !== select.selectedIndex;
          panel.open = !panel.hidden;
        }
      };
      select.addEventListener('change', showCase);
      widget.classList.add('is-enhanced');
      field.hidden = false;
      showCase();
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activate, {once: true});
  } else {
    activate();
  }
})();
