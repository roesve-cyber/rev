(function () {
    const DEVICE_KEY = 'mmpFolioDeviceId';
    const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let lastMomentKey = '';
    let momentSequence = 0;
    let memoryDeviceId = '';

    function pad2(value) {
        return String(value).padStart(2, '0');
    }

    function getDeviceId() {
        try {
            let id = localStorage.getItem(DEVICE_KEY);
            if (!id) {
                id = randomText(4);
                localStorage.setItem(DEVICE_KEY, id);
            }
            return id;
        } catch (err) {
            if (!memoryDeviceId) memoryDeviceId = randomText(4);
            return memoryDeviceId;
        }
    }

    function randomText(length) {
        const bytes = new Uint8Array(length);
        const cryptoApi = window.crypto || window.msCrypto;
        if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
            cryptoApi.getRandomValues(bytes);
            return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
        }
        return Array.from({ length }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    }

    function normalizePrefix(prefix) {
        return String(prefix || 'DOC')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 12) || 'DOC';
    }

    function nextSequence(momentKey) {
        if (momentKey === lastMomentKey) {
            momentSequence += 1;
        } else {
            lastMomentKey = momentKey;
            momentSequence = 1;
        }
        return momentSequence.toString(36).toUpperCase().padStart(4, '0');
    }

    function generate(prefix, options = {}) {
        const date = options.date ? new Date(options.date) : new Date();
        const fecha = [
            date.getFullYear(),
            pad2(date.getMonth() + 1),
            pad2(date.getDate())
        ].join('');
        const hora = [
            pad2(date.getHours()),
            pad2(date.getMinutes()),
            pad2(date.getSeconds())
        ].join('');
        const momentKey = `${fecha}${hora}`;
        const device = options.deviceId || getDeviceId();
        const sequence = options.sequence || nextSequence(momentKey);
        const suffix = options.suffix || randomText(options.randomLength || 5);
        return `${normalizePrefix(prefix)}-${fecha}-${hora}-${device}-${sequence}-${suffix}`;
    }

    window.FolioService = Object.freeze({
        generate,
        getDeviceId
    });
    window.generarFolioSistema = generate;
})();
