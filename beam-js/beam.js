(() => {
  const currentScript = document.currentScript
  const siteId = currentScript?.getAttribute('data-site-id')

  if (!siteId || navigator.doNotTrack === '1') {
    return
  }

  const endpoint = '/api/collect'
  const urlParams = new URLSearchParams(location.search)
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  function send(payload) {
    const body = JSON.stringify(payload)

    fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {})
  }

  const beam = window.beam || {}

  beam.track = (eventName, properties) => {
    if (!eventName) {
      return
    }

    const payload = {
      type: 'event',
      site_id: siteId,
      event_name: String(eventName).slice(0, 64),
      path: location.pathname,
      referrer: document.referrer,
      language: navigator.language,
      timezone,
    }

    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
      payload.properties = properties
    }

    send(payload)
  }

  window.beam = beam

  send({
    site_id: siteId,
    path: location.pathname,
    referrer: document.referrer,
    screen_width: screen.width,
    language: navigator.language,
    timezone,
    utm_source: urlParams.get('utm_source') || undefined,
    utm_medium: urlParams.get('utm_medium') || undefined,
    utm_campaign: urlParams.get('utm_campaign') || undefined,
  })
})()
