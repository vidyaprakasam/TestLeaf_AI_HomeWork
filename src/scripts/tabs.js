// Tab switching logic
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
      // Update button states
      document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  const selected = document.getElementById(button.dataset.tab + 'Tab');
  if (selected) selected.classList.add('active');

  // Ensure the container scrolls to top so content appears right under the tabs
  const container = document.querySelector('.container');
  if (container) container.scrollTop = 0;
    });
  });
}); 