import { readonly, ref } from "vue";

const toasts = ref([]);
let seed = 0;

export const toastList = readonly(toasts);

export function pushToast(message, type = "info", duration = 2200) {
  const id = `${Date.now()}-${seed++}`;
  toasts.value.push({ id, message, type });
  if (duration > 0) {
    window.setTimeout(() => removeToast(id), duration);
  }
  return id;
}

export function removeToast(id) {
  toasts.value = toasts.value.filter((item) => item.id !== id);
}
