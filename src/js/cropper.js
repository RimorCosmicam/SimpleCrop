/**
 * SimpleCrop - Cropper Module
 * Handles crop box interactions and aspect ratio constraints
 */

class Cropper {
    constructor(container, previewElement) {
        this.container = container;
        this.previewElement = previewElement;
        this.overlay = document.getElementById('crop-overlay');
        this.cropBox = document.getElementById('crop-box');

        this.isActive = false;
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;

        this.aspectRatio = null; // null for free aspect
        this.aspectRatios = {
            'free': null,
            '1:1': 1,
            '4:3': 4 / 3,
            '16:9': 16 / 9,
            '9:16': 9 / 16,
            '3:2': 3 / 2
        };

        // Crop box position and size (relative to preview)
        this.crop = {
            x: 0,
            y: 0,
            width: 0,
            height: 0
        };

        // Preview element bounds
        this.bounds = {
            left: 0,
            top: 0,
            width: 0,
            height: 0
        };

        this.dragStart = { x: 0, y: 0 };
        this.cropStart = { x: 0, y: 0, width: 0, height: 0 };

        this.onChangeCallback = null;

        this.init();
    }

    init() {
        // Bind event handlers
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        // Crop box drag
        this.cropBox.addEventListener('mousedown', this.handleMouseDown);

        // Handle resize handles
        const handles = this.cropBox.querySelectorAll('.crop-handle');
        handles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                this.startResize(e, handle.dataset.handle);
            });
        });

        // Global mouse events
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);

        // Aspect ratio buttons
        const aspectBtns = document.querySelectorAll('.aspect-btn');
        aspectBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                aspectBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.setAspectRatio(btn.dataset.ratio);
            });
        });
    }

    setPreviewElement(element) {
        this.previewElement = element;
    }

    activate(mediaWidth, mediaHeight) {
        this.isActive = true;
        this.overlay.classList.add('active');

        // Update bounds based on preview element
        this.updateBounds();

        // Initialize crop to full size
        this.crop = {
            x: 0,
            y: 0,
            width: this.bounds.width,
            height: this.bounds.height
        };

        // Store original media dimensions
        this.mediaWidth = mediaWidth;
        this.mediaHeight = mediaHeight;

        this.updateCropBox();

        // Show crop settings panel
        document.getElementById('crop-settings').style.display = 'block';
    }

    deactivate() {
        this.isActive = false;
        this.overlay.classList.remove('active');
        document.getElementById('crop-settings').style.display = 'none';
    }

    updateBounds() {
        const rect = this.previewElement.getBoundingClientRect();

        this.bounds = {
            left: 0,
            top: 0,
            width: rect.width,
            height: rect.height
        };

        // Position overlay to exactly cover the preview element
        // Since overlay is inside preview-wrapper and preview element is also there,
        // we need to offset by the element's position within the wrapper
        const wrapperRect = this.container.getBoundingClientRect();
        const offsetLeft = rect.left - wrapperRect.left;
        const offsetTop = rect.top - wrapperRect.top;

        this.overlay.style.left = `${offsetLeft}px`;
        this.overlay.style.top = `${offsetTop}px`;
        this.overlay.style.width = `${rect.width}px`;
        this.overlay.style.height = `${rect.height}px`;
    }

    setAspectRatio(ratio) {
        this.aspectRatio = this.aspectRatios[ratio] || null;

        if (this.aspectRatio && this.isActive) {
            // Adjust crop box to match aspect ratio
            this.constrainToAspectRatio();
            this.updateCropBox();
            this.notifyChange();
        }
    }

    constrainToAspectRatio() {
        if (!this.aspectRatio) return;

        const currentAspect = this.crop.width / this.crop.height;

        if (currentAspect > this.aspectRatio) {
            // Too wide, reduce width
            const newWidth = this.crop.height * this.aspectRatio;
            this.crop.x += (this.crop.width - newWidth) / 2;
            this.crop.width = newWidth;
        } else {
            // Too tall, reduce height
            const newHeight = this.crop.width / this.aspectRatio;
            this.crop.y += (this.crop.height - newHeight) / 2;
            this.crop.height = newHeight;
        }

        // Ensure within bounds
        this.constrainToBounds();
    }

    constrainToBounds() {
        this.crop.x = Math.max(0, Math.min(this.crop.x, this.bounds.width - this.crop.width));
        this.crop.y = Math.max(0, Math.min(this.crop.y, this.bounds.height - this.crop.height));
        this.crop.width = Math.min(this.crop.width, this.bounds.width - this.crop.x);
        this.crop.height = Math.min(this.crop.height, this.bounds.height - this.crop.y);
    }

    handleMouseDown(e) {
        if (!this.isActive) return;

        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.cropStart = { ...this.crop };

        e.preventDefault();
    }

    startResize(e, handle) {
        if (!this.isActive) return;

        this.isResizing = true;
        this.currentHandle = handle;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.cropStart = { ...this.crop };

        e.preventDefault();
    }

    handleMouseMove(e) {
        if (!this.isActive) return;
        if (!this.isDragging && !this.isResizing) return;

        const deltaX = e.clientX - this.dragStart.x;
        const deltaY = e.clientY - this.dragStart.y;

        if (this.isDragging) {
            // Move crop box
            this.crop.x = this.cropStart.x + deltaX;
            this.crop.y = this.cropStart.y + deltaY;
            this.constrainToBounds();
        } else if (this.isResizing) {
            // Resize from handle
            this.handleResize(deltaX, deltaY);
        }

        this.updateCropBox();
        this.notifyChange();
    }

    handleResize(deltaX, deltaY) {
        const minSize = 50;

        switch (this.currentHandle) {
            case 'nw':
                this.crop.x = Math.min(this.cropStart.x + deltaX, this.cropStart.x + this.cropStart.width - minSize);
                this.crop.y = Math.min(this.cropStart.y + deltaY, this.cropStart.y + this.cropStart.height - minSize);
                this.crop.width = this.cropStart.width - (this.crop.x - this.cropStart.x);
                this.crop.height = this.cropStart.height - (this.crop.y - this.cropStart.y);
                break;
            case 'ne':
                this.crop.y = Math.min(this.cropStart.y + deltaY, this.cropStart.y + this.cropStart.height - minSize);
                this.crop.width = Math.max(minSize, this.cropStart.width + deltaX);
                this.crop.height = this.cropStart.height - (this.crop.y - this.cropStart.y);
                break;
            case 'sw':
                this.crop.x = Math.min(this.cropStart.x + deltaX, this.cropStart.x + this.cropStart.width - minSize);
                this.crop.width = this.cropStart.width - (this.crop.x - this.cropStart.x);
                this.crop.height = Math.max(minSize, this.cropStart.height + deltaY);
                break;
            case 'se':
                this.crop.width = Math.max(minSize, this.cropStart.width + deltaX);
                this.crop.height = Math.max(minSize, this.cropStart.height + deltaY);
                break;
            case 'n':
                this.crop.y = Math.min(this.cropStart.y + deltaY, this.cropStart.y + this.cropStart.height - minSize);
                this.crop.height = this.cropStart.height - (this.crop.y - this.cropStart.y);
                break;
            case 's':
                this.crop.height = Math.max(minSize, this.cropStart.height + deltaY);
                break;
            case 'e':
                this.crop.width = Math.max(minSize, this.cropStart.width + deltaX);
                break;
            case 'w':
                this.crop.x = Math.min(this.cropStart.x + deltaX, this.cropStart.x + this.cropStart.width - minSize);
                this.crop.width = this.cropStart.width - (this.crop.x - this.cropStart.x);
                break;
        }

        // Apply aspect ratio constraint
        if (this.aspectRatio) {
            this.constrainResizeToAspectRatio();
        }

        // Keep within bounds
        this.crop.x = Math.max(0, this.crop.x);
        this.crop.y = Math.max(0, this.crop.y);
        this.crop.width = Math.min(this.crop.width, this.bounds.width - this.crop.x);
        this.crop.height = Math.min(this.crop.height, this.bounds.height - this.crop.y);
    }

    constrainResizeToAspectRatio() {
        // Adjust height to match aspect ratio based on width
        const targetHeight = this.crop.width / this.aspectRatio;

        if (targetHeight + this.crop.y <= this.bounds.height) {
            this.crop.height = targetHeight;
        } else {
            // Adjust width instead
            this.crop.height = this.bounds.height - this.crop.y;
            this.crop.width = this.crop.height * this.aspectRatio;
        }
    }

    handleMouseUp() {
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
    }

    updateCropBox() {
        this.cropBox.style.left = `${this.crop.x}px`;
        this.cropBox.style.top = `${this.crop.y}px`;
        this.cropBox.style.width = `${this.crop.width}px`;
        this.cropBox.style.height = `${this.crop.height}px`;
    }

    getCropData() {
        if (!this.isActive || !this.mediaWidth || !this.mediaHeight) {
            return null;
        }

        // Convert from preview coordinates to original image coordinates
        const scaleX = this.mediaWidth / this.bounds.width;
        const scaleY = this.mediaHeight / this.bounds.height;

        return {
            x: Math.round(this.crop.x * scaleX),
            y: Math.round(this.crop.y * scaleY),
            width: Math.round(this.crop.width * scaleX),
            height: Math.round(this.crop.height * scaleY)
        };
    }

    reset() {
        if (!this.isActive) return;

        this.crop = {
            x: 0,
            y: 0,
            width: this.bounds.width,
            height: this.bounds.height
        };

        // Reset aspect ratio
        this.aspectRatio = null;
        const aspectBtns = document.querySelectorAll('.aspect-btn');
        aspectBtns.forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-ratio="free"]')?.classList.add('active');

        this.updateCropBox();
        this.notifyChange();
    }

    onChange(callback) {
        this.onChangeCallback = callback;
    }

    notifyChange() {
        if (this.onChangeCallback) {
            this.onChangeCallback(this.getCropData());
        }
    }
}

window.Cropper = Cropper;
