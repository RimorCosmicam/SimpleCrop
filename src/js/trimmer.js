/**
 * SimpleCrop - Video Trimmer Module
 * Timeline-based video trimming with thumbnails
 */

class Trimmer {
    constructor(videoElement) {
        this.video = videoElement;
        this.container = document.getElementById('timeline-container');
        this.track = document.getElementById('timeline-track');
        this.thumbnailsContainer = document.getElementById('timeline-thumbnails');
        this.progressBar = document.getElementById('timeline-progress');
        this.selection = document.getElementById('timeline-selection');
        this.markerStart = document.getElementById('marker-start');
        this.markerEnd = document.getElementById('marker-end');

        this.currentTimeDisplay = document.getElementById('current-time');
        this.durationDisplay = document.getElementById('duration');
        this.trimStartDisplay = document.getElementById('trim-start');
        this.trimEndDisplay = document.getElementById('trim-end');

        this.playBtn = document.getElementById('btn-play');

        this.isActive = false;
        this.duration = 0;
        this.trimStart = 0;
        this.trimEnd = 0;

        this.isDraggingMarker = false;
        this.activeMarker = null;

        this.onChangeCallback = null;

        this.init();
    }

    init() {
        // Play/pause button
        this.playBtn.addEventListener('click', () => this.togglePlay());

        // Video time update
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('loadedmetadata', () => this.handleMetadataLoaded());

        // Marker dragging
        this.markerStart.addEventListener('mousedown', (e) => this.startDragMarker(e, 'start'));
        this.markerEnd.addEventListener('mousedown', (e) => this.startDragMarker(e, 'end'));

        document.addEventListener('mousemove', (e) => this.handleMarkerDrag(e));
        document.addEventListener('mouseup', () => this.stopDragMarker());

        // Click on track to seek
        this.track.addEventListener('click', (e) => {
            if (!this.isDraggingMarker) {
                this.seekToPosition(e);
            }
        });
    }

    activate(duration, thumbnails = []) {
        this.isActive = true;
        this.duration = duration;
        this.trimStart = 0;
        this.trimEnd = duration;

        this.container.classList.add('active');

        // Update displays
        this.durationDisplay.textContent = this.formatTime(duration);
        this.trimStartDisplay.textContent = this.formatTime(0);
        this.trimEndDisplay.textContent = this.formatTime(duration);

        // Set marker positions
        this.updateMarkers();

        // Load thumbnails
        this.loadThumbnails(thumbnails);
    }

    deactivate() {
        this.isActive = false;
        this.container.classList.remove('active');
        this.thumbnailsContainer.innerHTML = '';
        this.video.pause();
        this.updatePlayButton(false);
    }

    async loadThumbnails(thumbnails) {
        this.thumbnailsContainer.innerHTML = '';

        if (thumbnails.length === 0) {
            // Create placeholder thumbnails
            for (let i = 0; i < 10; i++) {
                const thumb = document.createElement('div');
                thumb.className = 'timeline-thumbnail';
                thumb.style.background = 'rgba(128, 128, 128, 0.2)';
                this.thumbnailsContainer.appendChild(thumb);
            }
            return;
        }

        thumbnails.forEach(src => {
            const thumb = document.createElement('div');
            thumb.className = 'timeline-thumbnail';
            thumb.style.backgroundImage = `url(${src})`;
            this.thumbnailsContainer.appendChild(thumb);
        });
    }

    togglePlay() {
        if (this.video.paused) {
            // Start from trim start if at the end
            if (this.video.currentTime >= this.trimEnd) {
                this.video.currentTime = this.trimStart;
            }
            this.video.play();
            this.updatePlayButton(true);

            // Stop at trim end
            this.checkTrimEnd();
        } else {
            this.video.pause();
            this.updatePlayButton(false);
        }
    }

    updatePlayButton(isPlaying) {
        const iconHtml = isPlaying
            ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
            : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        this.playBtn.innerHTML = iconHtml;
    }

    checkTrimEnd() {
        if (!this.video.paused) {
            if (this.video.currentTime >= this.trimEnd) {
                this.video.pause();
                this.video.currentTime = this.trimStart;
                this.updatePlayButton(false);
            } else {
                requestAnimationFrame(() => this.checkTrimEnd());
            }
        }
    }

    updateProgress() {
        if (!this.isActive) return;

        const percent = (this.video.currentTime / this.duration) * 100;
        this.progressBar.style.left = `${percent}%`;
        this.currentTimeDisplay.textContent = this.formatTime(this.video.currentTime);
    }

    handleMetadataLoaded() {
        if (this.isActive) {
            this.duration = this.video.duration;
            this.trimEnd = this.duration;
            this.durationDisplay.textContent = this.formatTime(this.duration);
            this.trimEndDisplay.textContent = this.formatTime(this.duration);
            this.updateMarkers();
        }
    }

    startDragMarker(e, marker) {
        e.stopPropagation();
        this.isDraggingMarker = true;
        this.activeMarker = marker;
    }

    handleMarkerDrag(e) {
        if (!this.isDraggingMarker || !this.isActive) return;

        const rect = this.track.getBoundingClientRect();
        let percent = (e.clientX - rect.left) / rect.width;
        percent = Math.max(0, Math.min(1, percent));

        const time = percent * this.duration;

        if (this.activeMarker === 'start') {
            this.trimStart = Math.min(time, this.trimEnd - 0.1);
            this.trimStartDisplay.textContent = this.formatTime(this.trimStart);
        } else {
            this.trimEnd = Math.max(time, this.trimStart + 0.1);
            this.trimEndDisplay.textContent = this.formatTime(this.trimEnd);
        }

        this.updateMarkers();
        this.notifyChange();
    }

    stopDragMarker() {
        this.isDraggingMarker = false;
        this.activeMarker = null;
    }

    updateMarkers() {
        const startPercent = (this.trimStart / this.duration) * 100;
        const endPercent = (this.trimEnd / this.duration) * 100;

        this.markerStart.style.left = `${startPercent}%`;
        this.markerEnd.style.left = `${endPercent}%`;

        // Update selection area
        this.selection.style.left = `${startPercent}%`;
        this.selection.style.width = `${endPercent - startPercent}%`;
    }

    seekToPosition(e) {
        if (!this.isActive) return;

        const rect = this.track.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        const time = percent * this.duration;

        // Clamp to trim range
        this.video.currentTime = Math.max(this.trimStart, Math.min(time, this.trimEnd));
    }

    getTrimData() {
        return {
            start: this.trimStart,
            end: this.trimEnd,
            duration: this.trimEnd - this.trimStart
        };
    }

    setTrimPoints(start, end) {
        this.trimStart = start;
        this.trimEnd = end;
        this.trimStartDisplay.textContent = this.formatTime(start);
        this.trimEndDisplay.textContent = this.formatTime(end);
        this.updateMarkers();
    }

    reset() {
        this.trimStart = 0;
        this.trimEnd = this.duration;
        this.trimStartDisplay.textContent = this.formatTime(0);
        this.trimEndDisplay.textContent = this.formatTime(this.duration);
        this.updateMarkers();
        this.video.currentTime = 0;
        this.notifyChange();
    }

    formatTime(seconds) {
        if (!isFinite(seconds)) return '00:00';

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    onChange(callback) {
        this.onChangeCallback = callback;
    }

    notifyChange() {
        if (this.onChangeCallback) {
            this.onChangeCallback(this.getTrimData());
        }
    }
}

window.Trimmer = Trimmer;
