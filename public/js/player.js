// Player.js - Main audio player functionality

class AudioPlayer {
    constructor() {
        // Audio context and elements
        this.audioContext = null;
        this.audioElement = new Audio();
        this.audioSource = null;
        this.gainNode = null;
        this.analyser = null;

        // State
        this.currentTrack = null;
        this.queue = [];
        this.queueIndex = -1;
        this.isPlaying = false;
        this.isSeeking = false;
        this.isShuffled = false;
        this.loopMode = 'none'; // 'none', 'one', 'all'
        this.volume = 0.8;
        this.playbackRate = 1.0;

        // Visualizer data
        this.visualizerType = localStorage.getItem('visualizerType') || 'bars';

        // DOM Elements
        this.trackTitleEl = document.getElementById('trackTitle');
        this.trackArtistEl = document.getElementById('trackArtist');
        this.trackAlbumEl = document.getElementById('trackAlbum');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        this.seekBarEl = document.getElementById('seekBar');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.rewind10Btn = document.getElementById('rewind10Btn');
        this.forward10Btn = document.getElementById('forward10Btn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.loopBtn = document.getElementById('loopBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.speedSlider = document.getElementById('speedSlider');
        this.speedValue = document.getElementById('speedValue');
        this.visualizerContainer = document.getElementById('visualizer');

        // Initialize
        this.init();
    }

    init() {
        // Initialize audio context
        this.initAudio();

        // Set initial volume from slider
        this.volumeSlider.value = this.volume * 100;

        // Set initial playback rate
        this.speedSlider.value = this.playbackRate * 100;
        this.speedValue.textContent = `${this.playbackRate.toFixed(1)}x`;

        // Event listeners
        this.setupEventListeners();

        // Initialize visualizer
        this.initVisualizer();

        // Update UI
        this.updateControls();
    }

    initAudio() {
        // Create audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();

        // Create nodes
        this.gainNode = this.audioContext.createGain();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;

        // Set volume
        this.gainNode.gain.value = this.volume;

        // Connect nodes
        this.audioSource = this.audioContext.createMediaElementSource(this.audioElement);
        this.audioSource.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        // Set initial properties
        this.audioElement.volume = this.volume;
        this.audioElement.playbackRate = this.playbackRate;
    }

    setupEventListeners() {
        // Play/Pause button
        this.playPauseBtn.addEventListener('click', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });

        // Previous track button
        this.prevBtn.addEventListener('click', () => this.playPrevious());

        // Next track button
        this.nextBtn.addEventListener('click', () => this.playNext());

        // Rewind 10 seconds button
        this.rewind10Btn.addEventListener('click', () => {
            this.audioElement.currentTime = Math.max(0, this.audioElement.currentTime - 10);
        });

        // Forward 10 seconds button
        this.forward10Btn.addEventListener('click', () => {
            this.audioElement.currentTime = Math.min(
                this.audioElement.duration,
                this.audioElement.currentTime + 10
            );
        });

        // Shuffle button
        this.shuffleBtn.addEventListener('click', () => {
            this.isShuffled = !this.isShuffled;
            this.updateControls();
        });

        // Loop button
        this.loopBtn.addEventListener('click', () => {
            // Cycle through loop modes: none -> one -> all -> none
            if (this.loopMode === 'none') {
                this.loopMode = 'one';
            } else if (this.loopMode === 'one') {
                this.loopMode = 'all';
            } else {
                this.loopMode = 'none';
            }
            this.updateControls();
        });

        // Volume slider
        this.volumeSlider.addEventListener('input', () => {
            this.volume = this.volumeSlider.value / 100;
            this.audioElement.volume = this.volume;
            this.gainNode.gain.value = this.volume;
        });

        // Playback rate slider
        this.speedSlider.addEventListener('input', () => {
            this.playbackRate = this.speedSlider.value / 100;
            this.audioElement.playbackRate = this.playbackRate;
            this.speedValue.textContent = `${this.playbackRate.toFixed(1)}x`;
        });

        // Seek bar
        this.seekBarEl.addEventListener('input', () => {
            this.isSeeking = true;
        });

        this.seekBarEl.addEventListener('change', () => {
            const seekTime = (this.seekBarEl.value / 100) * this.audioElement.duration;
            this.audioElement.currentTime = seekTime;
            this.isSeeking = false;
        });

        // Audio element events
        this.audioElement.addEventListener('timeupdate', () => this.updateProgress());
        this.audioElement.addEventListener('ended', () => this.handleTrackEnd());
        this.audioElement.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.showNotification('Error playing track. Try another one.');
            this.playNext();
        });

        // Navigation events for views
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const viewId = btn.getAttribute('data-view');
                this.showView(viewId);
            });
        });

        // Global key events
        document.addEventListener('keydown', (e) => {
            // Space key for play/pause
            if (e.code === 'Space' && !e.target.closest('input, textarea')) {
                e.preventDefault();
                if (this.isPlaying) {
                    this.pause();
                } else {
                    this.play();
                }
            }
        });

        // Media key support for headphones and bluetooth devices
        if ('mediaSession' in navigator) {
            navigator.mediaSession.setActionHandler('play', () => {
                this.play();
            });
            
            navigator.mediaSession.setActionHandler('pause', () => {
                this.pause();
            });
            
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                this.playPrevious();
            });
            
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                this.playNext();
            });
        }

        // Legacy media keys event (for broader device support)
        window.addEventListener('mediaplaypause', () => {
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        });
        
        // Listen for play/pause events from headphone buttons
        window.addEventListener('mediaplay', () => {
            this.play();
        });
        
        window.addEventListener('mediapause', () => {
            this.pause();
        });

        // Bluetooth button
        document.getElementById('bluetoothBtn').addEventListener('click', () => {
            this.showView('bluetoothView');
        });

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showView('settingsView');
        });

        // Theme selector
        document.getElementById('themeSelector').addEventListener('change', (e) => {
            this.setTheme(e.target.value);
        });

        // Visualization type selector
        document.getElementById('visualizationType').addEventListener('change', (e) => {
            this.visualizerType = e.target.value;
            localStorage.setItem('visualizerType', this.visualizerType);
            this.initVisualizer();
        });
    }

    loadTrack(track) {
        if (!track || !track.path) return;

        this.currentTrack = track;

        // Update audio source
        this.audioElement.src = `/api/files/stream?path=${encodeURIComponent(track.path)}`;
        this.audioElement.load();

        // Update UI
        this.trackTitleEl.textContent = track.title || 'Unknown Track';
        this.trackArtistEl.textContent = track.artist || 'Unknown Artist';
        this.trackAlbumEl.textContent = track.album || 'Unknown Album';

        // Reset progress
        this.updateProgress();

        // Auto play
        this.play();
        
        // Update MediaSession metadata for headphone control display
        if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title || 'Unknown Track',
                artist: track.artist || 'Unknown Artist',
                album: track.album || 'Unknown Album'
            });
        }
    }

    play() {
        if (!this.currentTrack) return;

        const playPromise = this.audioElement.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    this.isPlaying = true;
                    this.updateControls();

                    // Resume audio context if suspended
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                })
                .catch(error => {
                    console.error('Play error:', error);
                });
        }
    }

    pause() {
        this.audioElement.pause();
        this.isPlaying = false;
        this.updateControls();
    }

    playPrevious() {
        if (this.queue.length === 0) return;

        // If current time > 3 seconds, restart current track instead
        if (this.audioElement.currentTime > 3) {
            this.audioElement.currentTime = 0;
            return;
        }

        if (this.isShuffled) {
            // Play random track from queue
            const randomIndex = Math.floor(Math.random() * this.queue.length);
            this.queueIndex = randomIndex;
        } else {
            // Play previous track
            this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length;
        }

        this.loadTrack(this.queue[this.queueIndex]);
    }

    playNext() {
        if (this.queue.length === 0) return;

        if (this.isShuffled) {
            // Play random track from queue
            const randomIndex = Math.floor(Math.random() * this.queue.length);
            this.queueIndex = randomIndex;
        } else {
            // Play next track
            this.queueIndex = (this.queueIndex + 1) % this.queue.length;
        }

        this.loadTrack(this.queue[this.queueIndex]);
    }

    updateProgress() {
        if (this.isSeeking) return;

        const currentTime = this.audioElement.currentTime;
        const duration = this.audioElement.duration || 0;

        // Update time displays
        this.currentTimeEl.textContent = this.formatTime(currentTime);
        this.totalTimeEl.textContent = this.formatTime(duration);

        // Update seek bar
        this.seekBarEl.value = duration ? (currentTime / duration) * 100 : 0;
    }

    handleTrackEnd() {
        if (this.loopMode === 'one') {
            // Repeat current track
            this.audioElement.currentTime = 0;
            this.play();
        } else if (this.loopMode === 'all') {
            // Play next track, loop back to beginning when at the end
            this.playNext();
        } else if (this.queueIndex < this.queue.length - 1) {
            // Play next track if not at the end
            this.playNext();
        } else {
            // At the end of the queue and not looping
            this.isPlaying = false;
            this.updateControls();
        }
    }

    setQueue(tracks, startIndex = 0) {
        if (!tracks || !tracks.length) return;

        this.queue = [...tracks];
        this.queueIndex = startIndex;

        // Load and play the first track
        this.loadTrack(this.queue[this.queueIndex]);
    }

    addToQueue(track) {
        if (!track) return;

        this.queue.push(track);

        // If nothing is playing, start playing this track
        if (!this.currentTrack) {
            this.queueIndex = this.queue.length - 1;
            this.loadTrack(this.queue[this.queueIndex]);
        } else {
            this.showNotification('Added to Queue');
        }
    }

    clearQueue() {
        this.queue = [];
        this.queueIndex = -1;
    }

    updateControls() {
        // Update play/pause button
        if (this.isPlaying) {
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        } else {
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }

        // Update shuffle button
        if (this.isShuffled) {
            this.shuffleBtn.classList.add('active');
        } else {
            this.shuffleBtn.classList.remove('active');
        }

        // Update loop button
        this.loopBtn.classList.remove('active', 'loop-one', 'loop-all');
        if (this.loopMode === 'one') {
            this.loopBtn.classList.add('active', 'loop-one');
            this.loopBtn.innerHTML = '<i class="fas fa-repeat-1"></i>';
        } else if (this.loopMode === 'all') {
            this.loopBtn.classList.add('active', 'loop-all');
            this.loopBtn.innerHTML = '<i class="fas fa-redo-alt"></i>';
        } else {
            this.loopBtn.innerHTML = '<i class="fas fa-redo-alt"></i>';
        }
    }

    showView(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active-view');
        });

        // Show the selected view
        document.getElementById(viewId).classList.add('active-view');

        // Update navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-view') === viewId) {
                btn.classList.add('active');
            }
        });
    }

    initVisualizer() {
        // Clear previous visualizer
        this.visualizerContainer.innerHTML = '';

        if (this.visualizerType === 'bars') {
            this.initBarsVisualizer();
        } else if (this.visualizerType === 'wave') {
            this.initWaveVisualizer();
        } else if (this.visualizerType === 'circle') {
            this.initCircleVisualizer();
        }

        // Set default visualizer value in settings
        const visualTypeSelect = document.getElementById('visualizationType');
        if (visualTypeSelect) {
            visualTypeSelect.value = this.visualizerType;
        }
    }

    initBarsVisualizer() {
        const container = document.createElement('div');
        container.className = 'bars-visualizer';

        // Create bars
        const numBars = 20;
        for (let i = 0; i < numBars; i++) {
            const bar = document.createElement('div');
            bar.className = 'visualizer-bar';
            container.appendChild(bar);
        }

        this.visualizerContainer.appendChild(container);
        this.visualizerBars = Array.from(container.querySelectorAll('.visualizer-bar'));

        // Start animation
        this.startVisualizerAnimation();
    }

    initWaveVisualizer() {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;

        const container = document.createElement('div');
        container.className = 'wave-visualizer';
        container.appendChild(canvas);

        this.visualizerContainer.appendChild(container);
        this.visualizerCanvas = canvas;
        this.visualizerContext = canvas.getContext('2d');

        // Start animation
        this.startVisualizerAnimation();
    }

    initCircleVisualizer() {
        const container = document.createElement('div');
        container.className = 'circle-visualizer';

        // Create circles
        const numCircles = 5;
        for (let i = 0; i < numCircles; i++) {
            const circle = document.createElement('div');
            circle.className = 'visualizer-circle';
            container.appendChild(circle);
        }

        this.visualizerContainer.appendChild(container);
        this.visualizerCircles = Array.from(container.querySelectorAll('.visualizer-circle'));

        // Set initial circle sizes
        const baseSize = 40;
        this.visualizerCircles.forEach((circle, i) => {
            const size = baseSize + (i * 30);
            circle.style.width = `${size}px`;
            circle.style.height = `${size}px`;
        });

        // Start animation
        this.startVisualizerAnimation();
    }

    startVisualizerAnimation() {
        if (!this.analyser) return;

        // Set up animation
        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const animate = () => {
            requestAnimationFrame(animate);

            // Get frequency data
            this.analyser.getByteFrequencyData(dataArray);

            if (this.visualizerType === 'bars' && this.visualizerBars) {
                // Update bars
                const barWidth = 1 / this.visualizerBars.length;
                this.visualizerBars.forEach((bar, index) => {
                    const i = Math.floor(index * barWidth * bufferLength);
                    const value = dataArray[i] || 0;
                    const height = (value / 255) * 100;
                    bar.style.height = `${Math.max(4, height)}%`;
                });
            } else if (this.visualizerType === 'wave' && this.visualizerContext) {
                // Update wave
                const canvas = this.visualizerCanvas;
                const ctx = this.visualizerContext;
                const width = canvas.width;
                const height = canvas.height;

                ctx.clearRect(0, 0, width, height);
                ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary-light');
                ctx.lineWidth = 2;
                ctx.beginPath();

                const sliceWidth = width / bufferLength;
                let x = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = v * height / 2;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }

                    x += sliceWidth;
                }

                ctx.lineTo(width, height / 2);
                ctx.stroke();
            } else if (this.visualizerType === 'circle' && this.visualizerCircles) {
                // Update circles
                const maxValue = Math.max(...Array.from(dataArray).slice(0, 10));
                const scale = (maxValue / 255) * 0.5 + 0.5;

                this.visualizerCircles.forEach((circle, i) => {
                    circle.style.transform = `scale(${scale})`;
                    circle.style.opacity = 0.2 + (scale * 0.8);
                });
            }
        };

        animate();
    }

    showNotification(message) {
        // Simple notification
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    setTheme(theme) {
        document.body.classList.remove('light-theme', 'dark-theme');

        if (theme === 'light') {
            document.body.classList.add('light-theme');
        } else if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        }

        localStorage.setItem('theme', theme);
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) {
            return '0:00';
        }

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Modal functionality
class Modal {
    constructor() {
        this.modal = document.getElementById('modal');
        this.modalTitle = document.getElementById('modalTitle');
        this.modalBody = document.getElementById('modalBody');
        this.modalFooter = document.getElementById('modalFooter');
        this.closeModalBtn = document.getElementById('closeModalBtn');

        // Event listener
        this.closeModalBtn.addEventListener('click', () => this.hide());
    }

    show(options = {}) {
        const { title, content, buttons } = options;

        // Set title
        this.modalTitle.textContent = title || 'Modal';

        // Set content
        if (typeof content === 'string') {
            this.modalBody.innerHTML = content;
        } else {
            this.modalBody.innerHTML = '';
            if (content instanceof Element) {
                this.modalBody.appendChild(content);
            }
        }

        // Set buttons
        this.modalFooter.innerHTML = '';
        if (buttons && buttons.length) {
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.textContent = btn.text;
                button.className = btn.class || 'btn';
                button.addEventListener('click', () => {
                    if (btn.callback) btn.callback();
                    if (btn.closeModal !== false) this.hide();
                });
                this.modalFooter.appendChild(button);
            });
        } else {
            // Default OK button
            const okButton = document.createElement('button');
            okButton.textContent = 'OK';
            okButton.className = 'btn';
            okButton.addEventListener('click', () => this.hide());
            this.modalFooter.appendChild(okButton);
        }

        // Show modal
        this.modal.style.display = 'block';
    }

    hide() {
        this.modal.style.display = 'none';
    }

    prompt(title, placeholder, callback) {
        const content = document.createElement('div');

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder || '';

        content.appendChild(input);

        const buttons = [
            {
                text: 'Cancel',
                class: 'btn btn-secondary'
            },
            {
                text: 'OK',
                class: 'btn',
                callback: () => {
                    if (callback) callback(input.value);
                }
            }
        ];

        this.show({ title, content, buttons });

        // Focus input
        setTimeout(() => {
            input.focus();
            // Show keyboard
            keyboard.show(input);
        }, 300);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize player
    window.player = new AudioPlayer();

    // Initialize modal
    window.modal = new Modal();

    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        player.setTheme(savedTheme);
        const themeSelector = document.getElementById('themeSelector');
        if (themeSelector) {
            themeSelector.value = savedTheme;
        }
    }

    // Socket.io
    window.socket = io();

    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
});
