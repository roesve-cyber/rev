(function () {
    'use strict';

    const reduceMotion = window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : { matches: false };
    const recentAnimations = new WeakMap();

    function canAnimate(element) {
        return element instanceof Element && !reduceMotion.matches;
    }

    function restartAnimation(element, className) {
        if (!canAnimate(element)) return;
        element.classList.remove(className);
        void element.offsetWidth;
        element.classList.add(className);
        const cleanup = function (event) {
            if (event.target !== element) return;
            element.classList.remove(className);
            element.removeEventListener('animationend', cleanup);
        };
        element.addEventListener('animationend', cleanup);
    }

    function isVisible(element) {
        if (!element || element.classList.contains('oculto')) return false;
        return window.getComputedStyle(element).display !== 'none';
    }

    function animateView(view) {
        restartAnimation(view, 'mmp-view-enter');
    }

    function animateModal(modal) {
        if (!canAnimate(modal) || !isVisible(modal)) return;
        const now = Date.now();
        if (now - (recentAnimations.get(modal) || 0) < 120) return;
        recentAnimations.set(modal, now);
        restartAnimation(modal, 'mmp-modal-enter');
    }

    function pulseControl(element) {
        if (!element) return;
        const target = element.closest('label, button, [role="button"]') || element;
        restartAnimation(target, 'mmp-control-pulse');
    }

    function pulseCart() {
        restartAnimation(document.querySelector('.carrito-header'), 'mmp-cart-pulse');
        restartAnimation(document.getElementById('contadorCarrito'), 'mmp-badge-pulse');
    }

    function inspectNode(node) {
        if (!(node instanceof Element)) return;
        if (node.matches('.modal, [data-modal]:not([data-modal="menu-usuario"])')) {
            animateModal(node);
        }
        if (node.matches('.toast, .notificacion, [role="status"], [role="alert"]')) {
            restartAnimation(node, 'mmp-soft-reveal');
        }
        node.querySelectorAll('.modal, [data-modal]:not([data-modal="menu-usuario"])')
            .forEach(animateModal);
    }

    function startObserver() {
        if (!document.body || !window.MutationObserver) return;
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                Array.from(mutation.addedNodes).slice(0, 24).forEach(inspectNode);
            });
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    document.addEventListener('change', function (event) {
        if (event.target.matches('input[type="checkbox"], input[type="radio"], select')) {
            pulseControl(event.target);
        }
    });

    window.MotionService = Object.freeze({
        view: animateView,
        modal: animateModal,
        control: pulseControl,
        cart: pulseCart
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver, { once: true });
    } else {
        startObserver();
    }
})();
