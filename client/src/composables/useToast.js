import { ref } from 'vue'

const toasts = ref([])
let nextId = 0

function addToast(type, message, duration = 3000) {
  const id = nextId++
  toasts.value.push({ id, type, message })
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration)
  }
}

function removeToast(id) {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

function toast(message, duration) {
  addToast('info', message, duration)
}
toast.success = (msg, duration) => addToast('success', msg, duration)
toast.error = (msg, duration) => addToast('error', msg, duration || 4000)
toast.info = (msg, duration) => addToast('info', msg, duration)

export function useToast() {
  return { toasts, toast, removeToast }
}
