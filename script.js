// Passaparola — form handling.
//
// FORM_ENDPOINT: URL of a form backend that accepts POST (e.g. Formspree
// "https://formspree.io/f/xxxxxxx"). Left empty, submissions fall back to
// opening the visitor's mail client with a prefilled message to CONTACT_EMAIL.
const FORM_ENDPOINT = "";
const CONTACT_EMAIL = "ciao@passaparola.it";

const LABELS = {
  ristorante: "Candidatura ristorante",
  creator: "Candidatura creator",
};

// Hide broken images so the warm placeholder behind them shows instead.
document.querySelectorAll(".photo img").forEach((img) => {
  const markBroken = () => img.classList.add("is-broken");
  if (img.complete && img.naturalWidth === 0) markBroken();
  img.addEventListener("error", markBroken);
});

function setStatus(form, message, kind) {
  const status = form.querySelector(".form-status");
  status.textContent = message;
  status.className = "form-status" + (kind ? " is-" + kind : "");
}

function validate(form) {
  let firstInvalid = null;
  form.querySelectorAll("input, select").forEach((field) => {
    if (field.closest(".hp")) return;
    const ok = field.checkValidity();
    field.setAttribute("aria-invalid", ok ? "false" : "true");
    if (!ok && !firstInvalid) firstInvalid = field;
  });
  return firstInvalid;
}

function collect(form) {
  const data = {};
  new FormData(form).forEach((value, key) => {
    if (key === "website") return;
    data[key] = typeof value === "string" ? value.trim() : value;
  });
  data.privacy = data.privacy ? "sì" : "no";
  return data;
}

function mailtoFallback(type, data) {
  const lines = Object.entries(data).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  const subject = encodeURIComponent(`${LABELS[type]} — Passaparola`);
  const body = encodeURIComponent(lines.join("\n"));
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

document.querySelectorAll("form[data-form]").forEach((form) => {
  form.querySelectorAll("input, select").forEach((field) => {
    field.addEventListener("input", () => {
      if (field.getAttribute("aria-invalid") === "true" && field.checkValidity()) {
        field.setAttribute("aria-invalid", "false");
      }
    });
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const type = form.dataset.form;

    // Honeypot: bots fill the hidden field, people don't.
    if (form.querySelector('[name="website"]').value) return;

    const invalid = validate(form);
    if (invalid) {
      setStatus(form, "Controlla i campi evidenziati, per favore.", "error");
      invalid.focus();
      return;
    }

    const data = collect(form);

    if (!FORM_ENDPOINT) {
      mailtoFallback(type, data);
      setStatus(form, "Si è aperta la tua app email: invia il messaggio per completare la candidatura.", "ok");
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    setStatus(form, "Invio in corso…");

    try {
      const response = await fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tipo: LABELS[type], ...data }),
      });
      if (!response.ok) throw new Error(String(response.status));
      form.reset();
      setStatus(form, "Grazie! Abbiamo ricevuto la tua candidatura, ti ricontattiamo presto.", "ok");
    } catch (error) {
      setStatus(form, `Qualcosa è andato storto. Riprova o scrivici a ${CONTACT_EMAIL}.`, "error");
    } finally {
      button.disabled = false;
    }
  });
});
