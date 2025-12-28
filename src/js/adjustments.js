/**
 * SimpleCrop - Color & Level Adjustments Module
 * Real-time preview using CSS filters
 */

class Adjustments {
    constructor() {
        this.values = {
            brightness: 0,
            exposure: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            temperature: 0,
            shadows: 0,
            highlights: 0
        };

        this.sliders = {};
        this.valueDisplays = {};
        this.onChangeCallback = null;

        this.init();
    }

    init() {
        // Get all slider elements
        const sliderIds = ['brightness', 'exposure', 'contrast', 'saturation', 'hue', 'temperature', 'shadows', 'highlights'];

        sliderIds.forEach(id => {
            const slider = document.getElementById(id);
            const valueDisplay = document.getElementById(`${id}-value`);

            if (slider) {
                this.sliders[id] = slider;
                this.valueDisplays[id] = valueDisplay;

                slider.addEventListener('input', (e) => {
                    this.handleSliderChange(id, parseFloat(e.target.value));
                });

                // Double-click to reset
                slider.addEventListener('dblclick', () => {
                    this.resetValue(id);
                });
            }
        });
    }

    handleSliderChange(id, value) {
        this.values[id] = value;
        this.updateValueDisplay(id);

        if (this.onChangeCallback) {
            this.onChangeCallback(this.values);
        }
    }

    updateValueDisplay(id) {
        const display = this.valueDisplays[id];
        if (!display) return;

        const value = this.values[id];

        if (id === 'hue') {
            display.textContent = `${value}°`;
        } else {
            display.textContent = value > 0 ? `+${value}` : value;
        }
    }

    resetValue(id) {
        const defaultValue = id === 'hue' ? 0 : 0;
        this.values[id] = defaultValue;

        if (this.sliders[id]) {
            this.sliders[id].value = defaultValue;
        }

        this.updateValueDisplay(id);

        if (this.onChangeCallback) {
            this.onChangeCallback(this.values);
        }
    }

    resetAll() {
        Object.keys(this.values).forEach(id => {
            this.values[id] = 0;
            if (this.sliders[id]) {
                this.sliders[id].value = 0;
            }
            this.updateValueDisplay(id);
        });

        if (this.onChangeCallback) {
            this.onChangeCallback(this.values);
        }
    }

    setValues(values) {
        Object.keys(values).forEach(id => {
            if (this.values.hasOwnProperty(id)) {
                this.values[id] = values[id];
                if (this.sliders[id]) {
                    this.sliders[id].value = values[id];
                }
                this.updateValueDisplay(id);
            }
        });
    }

    getValues() {
        return { ...this.values };
    }

    onChange(callback) {
        this.onChangeCallback = callback;
    }

    /**
     * Generate CSS filter string for preview
     */
    getCSSFilter() {
        const filters = [];

        // Brightness: -100 to 100 maps to 0 to 2
        if (this.values.brightness !== 0) {
            const brightness = 1 + (this.values.brightness / 100);
            filters.push(`brightness(${brightness})`);
        }

        // Exposure (simulated with brightness)
        if (this.values.exposure !== 0) {
            const exposure = 1 + (this.values.exposure / 50);
            filters.push(`brightness(${exposure})`);
        }

        // Contrast: -100 to 100 maps to 0 to 2
        if (this.values.contrast !== 0) {
            const contrast = 1 + (this.values.contrast / 100);
            filters.push(`contrast(${contrast})`);
        }

        // Saturation: -100 to 100 maps to 0 to 2
        if (this.values.saturation !== 0) {
            const saturation = 1 + (this.values.saturation / 100);
            filters.push(`saturate(${saturation})`);
        }

        // Hue rotation
        if (this.values.hue !== 0) {
            filters.push(`hue-rotate(${this.values.hue}deg)`);
        }

        // Temperature (simulated with sepia + hue)
        if (this.values.temperature !== 0) {
            if (this.values.temperature > 0) {
                // Warm - add sepia
                const warmth = this.values.temperature / 100 * 0.3;
                filters.push(`sepia(${warmth})`);
            } else {
                // Cool - shift hue towards blue
                const cool = Math.abs(this.values.temperature) / 100 * 20;
                filters.push(`hue-rotate(${-cool}deg)`);
            }
        }

        // Shadows (simulated - darken the image slightly)
        if (this.values.shadows !== 0) {
            // This is a simplification - real shadows would need pixel manipulation
            const shadowMod = 1 + (this.values.shadows / 200);
            filters.push(`brightness(${shadowMod})`);
        }

        // Highlights (simulated)
        if (this.values.highlights !== 0) {
            const highlightMod = 1 + (this.values.highlights / 150);
            filters.push(`brightness(${highlightMod})`);
        }

        return filters.length > 0 ? filters.join(' ') : 'none';
    }

    /**
     * Get FFmpeg filter values (normalized for FFmpeg's eq filter)
     */
    getFFmpegValues() {
        return {
            // FFmpeg brightness: -1 to 1
            brightness: this.values.brightness / 100 * 0.5,
            // FFmpeg contrast: 0 to 2
            contrast: 1 + (this.values.contrast / 100),
            // FFmpeg saturation: 0 to 3
            saturation: 1 + (this.values.saturation / 100),
            // FFmpeg hue: degrees
            hue: this.values.hue
        };
    }
}

// Export for use in app
window.Adjustments = Adjustments;
