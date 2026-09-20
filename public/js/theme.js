// Theme Switcher & Mobile Navigation Module with LocalStorage Persistence
(function () {
  const storedTheme = localStorage.getItem('placement_theme') || 'light';
  document.documentElement.setAttribute('data-theme', storedTheme);

  document.addEventListener('DOMContentLoaded', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const iconEl = document.getElementById('theme-toggle-icon');
    const textEl = document.getElementById('theme-toggle-text');
    if (iconEl) iconEl.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    if (textEl) textEl.textContent = currentTheme === 'dark' ? 'Light' : 'Dark';
  });
})();

function toggleAppTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('placement_theme', newTheme);

  const iconEl = document.getElementById('theme-toggle-icon');
  const textEl = document.getElementById('theme-toggle-text');
  if (iconEl) iconEl.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  if (textEl) textEl.textContent = newTheme === 'dark' ? 'Light' : 'Dark';
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById('appSidebar') || document.querySelector('.app-sidebar');
  if (sidebar) {
    sidebar.classList.toggle('mobile-open');
  }
}

