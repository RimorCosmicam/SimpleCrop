/**
 * SimpleCrop - Exporter Module
 * Handles export modal and FFmpeg export operations
 */

class Exporter {
    constructor() {
        this.modal = document.getElementById('export-modal');
        this.formatGrid = document.getElementById('format-grid');
        this.progressContainer = document.getElementById('export-progress');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.modalFooter = document.getElementById('modal-footer');

        this.closeBtn = document.getElementById('modal-close');
        this.cancelBtn = document.getElementById('btn-cancel-export');
        this.confirmBtn = document.getElementById('btn-confirm-export');

        this.selectedFormat = null;
        this.isVideo = false;
        this.inputPath = null;

        this.imageFormats = ['jpg', 'png', 'webp'];
        this.videoFormats = ['mp4', 'mov', 'webm'];

        this.exportOptions = {};
        this.onExportCallback = null;

        this.init();
    }

    init() {
        // Close modal
        this.closeBtn.addEventListener('click', () => this.close());
        this.cancelBtn.addEventListener('click', () => this.close());

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Confirm export
        this.confirmBtn.addEventListener('click', () => this.startExport());

        // Listen for export progress from main process
        if (window.api?.onExportProgress) {
            window.api.onExportProgress((percent) => {
                this.updateProgress(percent);
            });
        }
    }

    open(isVideo, inputPath) {
        this.isVideo = isVideo;
        this.inputPath = inputPath;

        // Populate format buttons
        const formats = isVideo ? this.videoFormats : this.imageFormats;
        this.formatGrid.innerHTML = '';

        formats.forEach((format, index) => {
            const btn = document.createElement('button');
            btn.className = 'format-btn' + (index === 0 ? ' active' : '');
            btn.textContent = format.toUpperCase();
            btn.dataset.format = format;

            btn.addEventListener('click', () => {
                this.formatGrid.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedFormat = format;
            });

            this.formatGrid.appendChild(btn);
        });

        this.selectedFormat = formats[0];

        // Reset progress
        this.progressContainer.classList.remove('active');
        this.modalFooter.style.display = 'flex';

        // Show modal
        this.modal.classList.add('active');
    }

    close() {
        this.modal.classList.remove('active');
    }

    setExportOptions(options) {
        this.exportOptions = options;
    }

    async startExport() {
        if (!this.selectedFormat) return;

        // Show progress
        this.progressContainer.classList.add('active');
        this.modalFooter.style.display = 'none';
        this.updateProgress(0);

        try {
            // Get save path from user
            const defaultName = `export.${this.selectedFormat}`;
            const result = await window.api.saveFileDialog({
                defaultPath: defaultName,
                filters: [
                    { name: this.selectedFormat.toUpperCase(), extensions: [this.selectedFormat] }
                ]
            });

            if (result.canceled || !result.filePath) {
                this.resetExportUI();
                return;
            }

            const outputPath = result.filePath;

            if (this.isVideo) {
                // Video export with FFmpeg
                await this.exportVideo(outputPath);
            } else {
                // Image export
                await this.exportImage(outputPath);
            }

            this.updateProgress(100);
            this.progressText.textContent = 'Export complete!';

            setTimeout(() => {
                this.close();
                this.resetExportUI();
            }, 1000);

        } catch (error) {
            console.error('Export failed:', error);
            this.progressText.textContent = `Export failed: ${error.message}`;
            this.modalFooter.style.display = 'flex';
        }
    }

    async exportVideo(outputPath) {
        const options = {
            inputPath: this.inputPath,
            outputPath,
            crop: this.exportOptions.crop,
            trim: this.exportOptions.trim,
            adjustments: this.exportOptions.adjustments,
            format: this.selectedFormat
        };

        return await window.api.exportMedia(options);
    }

    async exportImage(outputPath) {
        // For images, we use the canvas data URL
        const dataURL = this.exportOptions.canvasDataURL;

        if (!dataURL) {
            throw new Error('No image data available');
        }

        return await window.api.exportImage({
            dataURL,
            outputPath
        });
    }

    updateProgress(percent) {
        const p = Math.round(percent);
        this.progressFill.style.width = `${p}%`;
        this.progressText.textContent = `Exporting... ${p}%`;
    }

    resetExportUI() {
        this.progressContainer.classList.remove('active');
        this.modalFooter.style.display = 'flex';
        this.progressFill.style.width = '0%';
        this.progressText.textContent = 'Exporting... 0%';
    }

    onExport(callback) {
        this.onExportCallback = callback;
    }
}

window.Exporter = Exporter;
