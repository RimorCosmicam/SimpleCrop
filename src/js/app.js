/**
 * SimpleCrop - Main Application Controller
 * Orchestrates all modules and handles media import/export
 */

class App {
    constructor() {
        // State
        this.mediaLoaded = false;
        this.isVideo = false;
        this.mediaPath = null;
        this.mediaInfo = null;
        this.originalImage = null;

        // Applied crop state (persisted across tool switches)
        this.appliedCrop = null;

        // DOM Elements
        this.emptyState = document.getElementById('empty-state');
        this.previewWrapper = document.getElementById('preview-wrapper');
        this.canvas = document.getElementById('preview-canvas');
        this.video = document.getElementById('preview-video');
        this.ctx = this.canvas.getContext('2d');

        // Current tool
        this.currentTool = 'adjust';

        // Initialize modules
        this.adjustments = new Adjustments();
        this.cropper = new Cropper(
            document.getElementById('preview-wrapper'),
            this.canvas
        );
        this.trimmer = new Trimmer(this.video);
        this.exporter = new Exporter();

        // Undo/Redo stack
        this.historyStack = [];
        this.historyIndex = -1;

        this.init();
    }

    init() {
        // Tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this.selectTool(btn.dataset.tool));
        });

        // Action buttons
        document.getElementById('btn-import').addEventListener('click', () => this.importMedia());
        document.getElementById('btn-import-empty').addEventListener('click', () => this.importMedia());
        document.getElementById('btn-export').addEventListener('click', () => this.openExport());
        document.getElementById('btn-reset').addEventListener('click', () => this.reset());

        // Crop action buttons
        document.getElementById('btn-apply-crop').addEventListener('click', () => this.applyCrop());
        document.getElementById('btn-clear-crop').addEventListener('click', () => this.clearCrop());

        // Adjustments callback
        this.adjustments.onChange((values) => this.applyAdjustments(values));

        // Cropper callback
        this.cropper.onChange((cropData) => {
            // Could show crop dimensions in UI
        });

        // Menu events from main process
        if (window.api) {
            window.api.onMenuImport(() => this.importMedia());
            window.api.onMenuExport(() => this.openExport());
            window.api.onMenuUndo(() => this.undo());
            window.api.onMenuRedo(() => this.redo());
        }

        // Glass opacity toggle
        const opaqueToggle = document.getElementById('toggle-opaque');
        if (opaqueToggle) {
            opaqueToggle.addEventListener('change', async (e) => {
                const isOpaque = e.target.checked;

                // Call main process to update glass
                if (window.api?.setGlassOpaque) {
                    await window.api.setGlassOpaque(isOpaque);
                }

                // Also update CSS - heavily frosted, not solid white
                const appEl = document.querySelector('.app');
                if (isOpaque) {
                    appEl.style.background = 'rgba(180, 180, 185, 0.85)';
                    appEl.style.backdropFilter = 'blur(60px) saturate(200%)';
                } else {
                    appEl.style.background = '';
                    appEl.style.backdropFilter = '';
                }
            });
        }

        // Glass settings modal
        this.setupGlassSettings();

        // Handle window resize
        window.addEventListener('resize', () => {
            if (this.mediaLoaded && this.cropper.isActive) {
                this.cropper.updateBounds();
            }
        });
    }

    setupGlassSettings() {
        const glassSettingsPanel = document.getElementById('glass-settings');
        const openBtn = document.getElementById('btn-glass-settings');
        const applyBtn = document.getElementById('glass-settings-apply');
        const resetBtn = document.getElementById('glass-settings-reset');

        // Controls
        const variantGrid = document.getElementById('glass-variant-grid');
        const radiusSlider = document.getElementById('glass-radius');
        const opacitySlider = document.getElementById('glass-opacity');
        const borderOpacitySlider = document.getElementById('glass-border-opacity');
        const customTintToggle = document.getElementById('glass-tint-custom');
        const tintSection = document.getElementById('glass-tint-section');
        const tintInput = document.getElementById('glass-tint');
        const tintPicker = document.getElementById('glass-tint-picker');
        const scrimToggle = document.getElementById('glass-scrim');
        const subduedToggle = document.getElementById('glass-subdued');

        // Value displays
        const variantValue = document.getElementById('glass-variant-value');
        const radiusValue = document.getElementById('glass-radius-value');
        const opacityValue = document.getElementById('glass-opacity-value');
        const borderOpacityValue = document.getElementById('glass-border-opacity-value');

        // UI Panel Controls
        const panelOpacitySlider = document.getElementById('glass-panel-opacity');
        const panelBorderSlider = document.getElementById('glass-panel-border');
        const panelOpacityValue = document.getElementById('glass-panel-opacity-value');
        const panelBorderValue = document.getElementById('glass-panel-border-value');

        // Tabs
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        // State
        if (openBtn) openBtn.title = 'Glass Settings';
        let currentVariant = 11;

        // --- Helper Functions ---

        const applyCSSChanges = (useCustom, tintColor, cornerRadius, settings) => {
            const appEl = document.querySelector('.app');
            if (!appEl) return;

            if (!useCustom) {
                appEl.style.background = '';
            } else if (tintColor && tintColor.length >= 7) {
                let r = parseInt(tintColor.slice(1, 3), 16);
                let g = parseInt(tintColor.slice(3, 5), 16);
                let b = parseInt(tintColor.slice(5, 7), 16);
                // Use the opacity slider value for the alpha channel
                let a = settings ? (settings.opacity / 100).toFixed(2) : (tintColor.length >= 9 ? parseInt(tintColor.slice(7, 9), 16) / 255 : 0.4);
                appEl.style.background = `rgba(${r}, ${g}, ${b}, ${a})`;
            }

            if (cornerRadius !== undefined) {
                appEl.style.borderRadius = `${cornerRadius}px`;
            }

            if (settings) {
                appEl.style.setProperty('--bg-opacity', (settings.opacity / 100).toFixed(2));
                appEl.style.setProperty('--bg-border-opacity', (settings.borderOpacity / 100).toFixed(2));
                appEl.style.setProperty('--panel-opacity', (settings.panelOpacity / 100).toFixed(2));
                appEl.style.setProperty('--panel-border-opacity', (settings.panelBorderOpacity / 100).toFixed(2));
            }
        };

        const handleUpdate = async (save = false) => {
            const settings = {
                variant: currentVariant,
                cornerRadius: parseInt(radiusSlider?.value || 12),
                opacity: parseInt(opacitySlider?.value || 31),
                borderOpacity: parseInt(borderOpacitySlider?.value || 15),
                useCustomTint: customTintToggle?.checked || false,
                tintColor: tintInput?.value || '#1a1a1a50',
                panelOpacity: parseInt(panelOpacitySlider?.value || 25),
                panelBorderOpacity: parseInt(panelBorderSlider?.value || 4),
                scrim: scrimToggle?.checked ? 1 : 0,
                subdued: subduedToggle?.checked ? 1 : 0
            };

            applyCSSChanges(settings.useCustomTint, settings.tintColor, settings.cornerRadius, settings);

            if (window.api?.updateGlassSettings) {
                await window.api.updateGlassSettings(settings, save);
            }
        };

        const initVariantGrid = (gridEl, valueEl) => {
            if (!gridEl) return;
            gridEl.innerHTML = '';
            for (let i = 0; i <= 19; i++) {
                const btn = document.createElement('button');
                btn.className = `variant-btn ${i === currentVariant ? 'active' : ''}`;
                btn.textContent = i;
                btn.addEventListener('click', () => {
                    currentVariant = i;
                    document.querySelectorAll('#glass-variant-grid .variant-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (valueEl) valueEl.textContent = i;
                    handleUpdate();
                });
                gridEl.appendChild(btn);
            }
        };

        const initialInit = () => {
            currentVariant = 11;
            if (variantValue) variantValue.textContent = '11';
            if (radiusSlider) radiusSlider.value = 12;
            if (radiusValue) radiusValue.textContent = '12';
            if (opacitySlider) opacitySlider.value = 31;
            if (opacityValue) opacityValue.textContent = '31';
            if (borderOpacitySlider) borderOpacitySlider.value = 15;
            if (borderOpacityValue) borderOpacityValue.textContent = '15';

            if (panelOpacitySlider) panelOpacitySlider.value = 25;
            if (panelOpacityValue) panelOpacityValue.textContent = '25';
            if (panelBorderSlider) panelBorderSlider.value = 4;
            if (panelBorderValue) panelBorderValue.textContent = '4';

            if (customTintToggle) customTintToggle.checked = true;
            if (tintInput) tintInput.value = '#1a1a1a50';

            initVariantGrid(variantGrid, variantValue);
            handleUpdate();
        };

        // --- Event Listeners ---

        document.querySelectorAll('.collapsible-toggle').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const targetId = toggle.getAttribute('data-target');
                const target = document.getElementById(targetId);
                if (target) {
                    target.classList.toggle('hidden');
                    toggle.classList.toggle('collapsed');
                }
            });
        });

        const syncLabel = (slider, label) => {
            slider?.addEventListener('input', () => {
                if (label) label.textContent = slider.value;
                handleUpdate();
            });
        };

        syncLabel(radiusSlider, radiusValue);
        syncLabel(opacitySlider, opacityValue);
        syncLabel(borderOpacitySlider, borderOpacityValue);
        syncLabel(panelOpacitySlider, panelOpacityValue);
        syncLabel(panelBorderSlider, panelBorderValue);

        openBtn?.addEventListener('click', () => {
            document.getElementById('crop-settings').style.display = 'none';
            document.getElementById('color-settings').style.display = 'none';
            if (glassSettingsPanel) glassSettingsPanel.style.display = 'block';
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            if (openBtn) openBtn.classList.add('active');
        });

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${tabId}`)?.classList.add('active');
            });
        });

        customTintToggle?.addEventListener('change', () => {
            tintSection?.classList.toggle('disabled', !customTintToggle.checked);
            handleUpdate();
        });

        scrimToggle?.addEventListener('change', () => handleUpdate());
        subduedToggle?.addEventListener('change', () => handleUpdate());
        applyBtn?.addEventListener('click', () => handleUpdate(true));
        resetBtn?.addEventListener('click', () => initialInit());

        // Startup
        initialInit();

        window.api?.onReceivePanelSettings((settings) => {
            if (settings) {
                // Update state if needed
                if (settings.variant !== undefined) currentVariant = settings.variant;

                // Sync sliders
                if (panelOpacitySlider) panelOpacitySlider.value = settings.panelOpacity;
                if (panelOpacityValue) panelOpacityValue.textContent = settings.panelOpacity;
                if (panelBorderSlider) panelBorderSlider.value = settings.panelBorderOpacity;
                if (panelBorderValue) panelBorderValue.textContent = settings.panelBorderOpacity;

                // Sync background sliders if they exist in main process
                if (opacitySlider && settings.opacity !== undefined) {
                    opacitySlider.value = settings.opacity;
                    if (opacityValue) opacityValue.textContent = settings.opacity;
                }

                applyCSSChanges(settings.useCustomTint, settings.tintColor, settings.cornerRadius, settings);
            }
        });
    }

    selectTool(tool) {
        this.currentTool = tool;

        // Update active button
        document.querySelectorAll('.tool-btn').forEach(btn => {
            const isTool = btn.dataset.tool === tool;
            const isGlass = btn.id === 'btn-glass-settings';
            btn.classList.toggle('active', isTool);
        });

        // Show/hide relevant panels
        const cropSettings = document.getElementById('crop-settings');
        const colorSettings = document.getElementById('color-settings');
        const glassSettings = document.getElementById('glass-settings');

        // Hide glass settings when selecting a main tool
        if (glassSettings) glassSettings.style.display = 'none';

        cropSettings.style.display = tool === 'crop' ? 'block' : 'none';
        colorSettings.style.display = (tool === 'adjust' || tool === 'crop') ? 'block' : 'none';

        // Activate/deactivate cropper
        if (tool === 'crop' && this.mediaLoaded) {
            // Set the correct preview element for the cropper
            this.cropper.setPreviewElement(this.isVideo ? this.video : this.canvas);
            this.cropper.activate(
                this.isVideo ? this.mediaInfo.width : this.originalImage.width,
                this.isVideo ? this.mediaInfo.height : this.originalImage.height
            );
        } else {
            this.cropper.deactivate();
        }

        // Show timeline for trim tool on videos
        if (tool === 'trim' && this.isVideo) {
            this.trimmer.activate(this.mediaInfo.duration);
        }
    }

    async importMedia() {
        try {
            const result = await window.api.openFileDialog({
                filters: [
                    { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'avi'] }
                ]
            });

            if (result.canceled || !result.filePaths.length) return;

            const filePath = result.filePaths[0];
            const ext = filePath.split('.').pop().toLowerCase();

            // Determine if video or image
            this.isVideo = ['mp4', 'mov', 'webm', 'avi'].includes(ext);
            this.mediaPath = filePath;

            // Get media info
            this.mediaInfo = await window.api.getMediaInfo(filePath);

            // Load media data
            const dataURL = await window.api.readFileAsDataURL(filePath);

            if (this.isVideo) {
                await this.loadVideo(dataURL);
            } else {
                await this.loadImage(dataURL);
            }

            // Show preview, hide empty state
            this.emptyState.style.display = 'none';
            this.previewWrapper.style.display = 'flex';
            this.mediaLoaded = true;

            // Reset tools
            this.adjustments.resetAll();
            this.selectTool(this.currentTool);

            // Load thumbnails for video timeline
            if (this.isVideo) {
                this.loadVideoThumbnails();
            }

        } catch (error) {
            console.error('Import failed:', error);
        }
    }

    async loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;

                // Size canvas to fit in container while maintaining aspect ratio
                const containerRect = document.querySelector('.preview-area').getBoundingClientRect();
                const maxWidth = containerRect.width - 40;
                const maxHeight = containerRect.height - 40;

                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }

                this.canvas.width = width;
                this.canvas.height = height;
                this.canvas.style.display = 'block';
                this.video.style.display = 'none';

                this.drawImage();
                resolve();
            };
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    async loadVideo(dataURL) {
        return new Promise((resolve, reject) => {
            this.video.onloadeddata = () => {
                // Size video to fit in container
                const containerRect = document.querySelector('.preview-area').getBoundingClientRect();
                const maxWidth = containerRect.width - 40;
                const maxHeight = containerRect.height - 40;

                let width = this.video.videoWidth;
                let height = this.video.videoHeight;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (maxHeight / height) * width;
                    height = maxHeight;
                }

                this.video.width = width;
                this.video.height = height;
                this.video.style.display = 'block';
                this.canvas.style.display = 'none';

                resolve();
            };
            this.video.onerror = reject;
            this.video.src = dataURL;
        });
    }

    async loadVideoThumbnails() {
        try {
            const thumbnails = await window.api.getVideoThumbnails({
                filePath: this.mediaPath,
                count: 10
            });
            this.trimmer.loadThumbnails(thumbnails);
        } catch (error) {
            console.error('Failed to load thumbnails:', error);
        }
    }

    drawImage() {
        if (!this.originalImage) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(
            this.originalImage,
            0, 0,
            this.canvas.width, this.canvas.height
        );
    }

    applyAdjustments(values) {
        const filter = this.adjustments.getCSSFilter();

        if (this.isVideo) {
            this.video.style.filter = filter;
        } else {
            this.canvas.style.filter = filter;
        }
    }

    openExport() {
        if (!this.mediaLoaded) return;

        // Prepare export options - use appliedCrop for the final crop
        const options = {
            crop: this.appliedCrop,
            adjustments: this.adjustments.getFFmpegValues(),
            trim: this.isVideo ? this.trimmer.getTrimData() : null
        };

        // For images, generate canvas data with applied crops and adjustments
        if (!this.isVideo) {
            options.canvasDataURL = this.generateExportCanvas();
        }

        this.exporter.setExportOptions(options);
        this.exporter.open(this.isVideo, this.mediaPath);
    }

    generateExportCanvas() {
        if (!this.originalImage) return null;

        // Create offscreen canvas at original resolution
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');

        // Use applied crop or full image
        const crop = this.appliedCrop || {
            x: 0,
            y: 0,
            width: this.originalImage.width,
            height: this.originalImage.height
        };

        exportCanvas.width = crop.width;
        exportCanvas.height = crop.height;

        // Apply CSS filter equivalent
        exportCtx.filter = this.adjustments.getCSSFilter();

        // Draw cropped region
        exportCtx.drawImage(
            this.originalImage,
            crop.x, crop.y, crop.width, crop.height,
            0, 0, crop.width, crop.height
        );

        return exportCanvas.toDataURL('image/png');
    }

    applyCrop() {
        const cropData = this.cropper.getCropData();
        if (!cropData) return;

        // Store the applied crop
        this.appliedCrop = cropData;

        // Apply visual crop
        this.applyCropVisually();

        // Deactivate crop tool overlay (but keep the crop applied)
        this.cropper.deactivate();

        // Switch to adjust tool to show the result
        this.selectTool('adjust');
    }

    clearCrop() {
        this.appliedCrop = null;

        // Remove visual crop
        const element = this.isVideo ? this.video : this.canvas;
        element.style.clipPath = '';
        element.style.transform = '';
        element.style.transformOrigin = '';

        // Reset wrapper size
        this.previewWrapper.style.width = '';
        this.previewWrapper.style.height = '';
        this.previewWrapper.style.overflow = '';

        // Reset cropper
        this.cropper.reset();
    }

    applyCropVisually() {
        if (!this.appliedCrop) return;

        const element = this.isVideo ? this.video : this.canvas;
        const crop = this.appliedCrop;

        // Get the original media dimensions
        const mediaWidth = this.isVideo ? this.mediaInfo.width : this.originalImage.width;
        const mediaHeight = this.isVideo ? this.mediaInfo.height : this.originalImage.height;

        // Get current display dimensions
        const displayWidth = element.offsetWidth || element.width;
        const displayHeight = element.offsetHeight || element.height;

        // Calculate scale factors
        const scaleX = displayWidth / mediaWidth;
        const scaleY = displayHeight / mediaHeight;

        // Convert crop coordinates to display coordinates
        const displayCropX = crop.x * scaleX;
        const displayCropY = crop.y * scaleY;
        const displayCropWidth = crop.width * scaleX;
        const displayCropHeight = crop.height * scaleY;

        // Use clip-path to show only the cropped region
        // inset(top right bottom left)
        const insetTop = displayCropY;
        const insetRight = displayWidth - (displayCropX + displayCropWidth);
        const insetBottom = displayHeight - (displayCropY + displayCropHeight);
        const insetLeft = displayCropX;

        element.style.clipPath = `inset(${insetTop}px ${insetRight}px ${insetBottom}px ${insetLeft}px)`;

        // Transform to center the cropped region and scale it up
        const translateX = -displayCropX + (displayWidth - displayCropWidth) / 2;
        const translateY = -displayCropY + (displayHeight - displayCropHeight) / 2;
        const scale = Math.min(displayWidth / displayCropWidth, displayHeight / displayCropHeight);

        element.style.transformOrigin = 'center center';
        element.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;

        // Set wrapper to clip overflow
        this.previewWrapper.style.overflow = 'hidden';
    }

    reset() {
        this.adjustments.resetAll();
        this.cropper.reset();
        this.clearCrop();

        if (this.isVideo) {
            this.trimmer.reset();
        }
    }

    // Simple undo/redo (could be expanded)
    saveState() {
        const state = {
            adjustments: this.adjustments.getValues(),
            crop: this.cropper.getCropData(),
            trim: this.isVideo ? this.trimmer.getTrimData() : null
        };

        // Remove any redo states
        this.historyStack = this.historyStack.slice(0, this.historyIndex + 1);
        this.historyStack.push(state);
        this.historyIndex = this.historyStack.length - 1;
    }

    undo() {
        if (this.historyIndex <= 0) return;

        this.historyIndex--;
        this.restoreState(this.historyStack[this.historyIndex]);
    }

    redo() {
        if (this.historyIndex >= this.historyStack.length - 1) return;

        this.historyIndex++;
        this.restoreState(this.historyStack[this.historyIndex]);
    }

    restoreState(state) {
        if (!state) return;

        this.adjustments.setValues(state.adjustments);
        this.applyAdjustments(state.adjustments);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
