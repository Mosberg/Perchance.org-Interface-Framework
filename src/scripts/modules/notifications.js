export function createNotificationsModule(app) {
  const { refs } = app;

  function notify(level, message, duration = 2200) {
    const toast = document.createElement("div");
    toast.className = `toast ${level}`;
    toast.textContent = message;
    refs.toastRack.append(toast);
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  return {
    notify,
  };
}
