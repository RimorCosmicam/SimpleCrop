const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;

// Import Liquid Glass
let liquidGlass;
try {
  liquidGlass = require('electron-liquid-glass');
  console.log('Liquid Glass loaded:', !!liquidGlass);
  console.log('Glass methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(liquidGlass)));
  // Check if glass is supported on this platform
  if (liquidGlass._isGlassSupported !== undefined) {
    console.log('Glass supported:', liquidGlass._isGlassSupported);
  }
} catch (e) {
  console.error('Liquid Glass import error:', e.message);
  liquidGlass = null;
}

// Set FFmpeg paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

let mainWindow;
let glassId = null;

// Settings persistence
const SETTINGS_PATH = path.join(app.getPath('userData'), 'glass-settings.json');
const DEFAULT_SETTINGS = {
  variant: 11,
  cornerRadius: 12,
  tintColor: '#1a1a1a50',
  scrim: 0,
  subdued: 0,
  panelBlur: 30,
  panelOpacity: 25,
  panelBorderOpacity: 4,
  backgroundBlur: 30
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function applyGlassSettings(win, settings) {
  if (!liquidGlass || process.platform !== 'darwin') return;

  try {
    const handle = win.getNativeWindowHandle();
    const newGlassId = liquidGlass.addView(handle, {
      cornerRadius: settings.cornerRadius || 12,
      tintColor: settings.tintColor || '#1a1a1a50',
      opaque: false
    });
    glassId = newGlassId;

    if (glassId !== null) {
      liquidGlass.unstable_setVariant(glassId, parseInt(settings.variant || 11));
      liquidGlass.unstable_setScrim(glassId, parseInt(settings.scrim || 0));
      liquidGlass.unstable_setSubdued(glassId, parseInt(settings.subdued || 0));
    }

    // Send panel and background settings to frontend
    win.webContents.send('glass:panelSettings', {
      panelBlur: settings.panelBlur || 30,
      panelOpacity: settings.panelOpacity || 25,
      panelBorderOpacity: settings.panelBorderOpacity || 4,
      backgroundBlur: settings.backgroundBlur || 30
    });

    console.log('Glass applied with ID:', glassId, 'Settings:', settings);
  } catch (e) {
    console.error('Failed to apply glass settings:', e);
  }
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    // Do NOT set vibrancy with liquid glass
    vibrancy: undefined,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Ensure window buttons are visible
  mainWindow.setWindowButtonVisibility(true);

  mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

  // Apply Liquid Glass effect after content loads
  mainWindow.webContents.once('did-finish-load', () => {
    const settings = loadSettings();
    applyGlassSettings(mainWindow, settings);
  });

  // Open DevTools in development
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    glassId = null;
  });

  // Set About Panel Options
  app.setAboutPanelOptions({
    applicationName: 'SimpleCrop',
    applicationVersion: 'V1',
    copyright: 'Made by Judelawrosa with love',
    credits: 'Contact: jvictordr@gmail.com',
    iconPath: path.join(__dirname, 'Icons/Icon-iOS-Default-1024x1024@1x.png')
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'SimpleCrop',
      submenu: [
        { role: 'about', label: 'About SimpleCrop' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Import Media...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:import')
        },
        { type: 'separator' },
        {
          label: 'Export...',
          accelerator: 'CmdOrCtrl+E',
          click: () => mainWindow?.webContents.send('menu:export')
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu:undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => mainWindow?.webContents.send('menu:redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  app.name = 'SimpleCrop';
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers


// Glass settings update (debug)
ipcMain.handle('glass:updateSettings', async (event, settings, persist = false) => {
  const { variant, cornerRadius, tintColor, scrim, subdued } = settings;

  if (liquidGlass && process.platform === 'darwin') {
    try {
      // If we are persisting, save to disk
      if (persist) {
        saveSettings(settings);
      }

      // Re-apply the glass view to update tint/radius
      // Note: Re-adding is currently the most reliable way to change core props
      const newGlassId = liquidGlass.addView(mainWindow.getNativeWindowHandle(), {
        cornerRadius: cornerRadius !== undefined ? cornerRadius : 12,
        tintColor: tintColor || '#1a1a1a50',
        opaque: false
      });
      glassId = newGlassId;

      if (glassId !== null) {
        if (variant !== undefined) liquidGlass.unstable_setVariant(glassId, parseInt(variant));
        if (scrim !== undefined) liquidGlass.unstable_setScrim(glassId, parseInt(scrim));
        if (subdued !== undefined) liquidGlass.unstable_setSubdued(glassId, parseInt(subdued));
      }

      return { success: true, settings, glassId };
    } catch (e) {
      console.error('Failed to update glass settings:', e);
      return { success: false, error: e.message };
    }
  }

  return { success: false, error: 'Native glass not available' };
});

// Open file dialog
ipcMain.handle('dialog:openFile', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options?.filters || [
      { name: 'Media', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'avi'] }
    ]
  });
  return result;
});

// Save file dialog
ipcMain.handle('dialog:saveFile', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options?.defaultPath,
    filters: options?.filters || [
      { name: 'Images', extensions: ['jpg', 'png', 'webp'] },
      { name: 'Videos', extensions: ['mp4', 'mov', 'webm'] }
    ]
  });
  return result;
});

// Read file as base64
ipcMain.handle('file:readAsDataURL', async (event, filePath) => {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    avi: 'video/x-msvideo'
  };
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
});

// Get media info using ffprobe
ipcMain.handle('media:getInfo', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        resolve({
          duration: metadata.format.duration,
          width: videoStream?.width,
          height: videoStream?.height,
          fps: videoStream ? eval(videoStream.r_frame_rate) : null,
          hasAudio: !!audioStream,
          format: metadata.format.format_name,
          isVideo: !!videoStream && metadata.format.duration > 0
        });
      }
    });
  });
});

// Export media with FFmpeg
ipcMain.handle('media:export', async (event, options) => {
  const { inputPath, outputPath, crop, trim, adjustments, format } = options;

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    // Build filter chain
    const filters = [];

    // Crop filter
    if (crop) {
      filters.push(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`);
    }

    // Color adjustments
    if (adjustments) {
      const { brightness, contrast, saturation } = adjustments;
      if (brightness !== 0 || contrast !== 1 || saturation !== 1) {
        filters.push(`eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}`);
      }
      if (adjustments.hue !== 0) {
        filters.push(`hue=h=${adjustments.hue}`);
      }
    }

    if (filters.length > 0) {
      command = command.videoFilters(filters);
    }

    // Trim
    if (trim) {
      command = command.setStartTime(trim.start).setDuration(trim.end - trim.start);
    }

    // Output settings based on format
    const ext = path.extname(outputPath).toLowerCase();
    if (ext === '.mp4') {
      command = command.outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-c:a aac']);
    } else if (ext === '.mov') {
      command = command.outputOptions(['-c:v prores_ks', '-profile:v 3', '-c:a pcm_s16le']);
    } else if (ext === '.webm') {
      command = command.outputOptions(['-c:v libvpx-vp9', '-crf 30', '-c:a libopus']);
    }

    command
      .on('start', (cmd) => {
        console.log('FFmpeg command:', cmd);
      })
      .on('progress', (progress) => {
        mainWindow?.webContents.send('export:progress', progress.percent || 0);
      })
      .on('end', () => {
        resolve({ success: true, outputPath });
      })
      .on('error', (err) => {
        reject(err);
      })
      .save(outputPath);
  });
});

// Export image (for static images, no FFmpeg needed)
ipcMain.handle('image:export', async (event, options) => {
  const { dataURL, outputPath } = options;
  const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(outputPath, buffer);
  return { success: true, outputPath };
});

// Generate video thumbnails for timeline
ipcMain.handle('video:getThumbnails', async (event, options) => {
  const { filePath, count = 10 } = options;
  const tempDir = path.join(app.getPath('temp'), 'simplecrop-thumbs');

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .on('end', () => {
        const thumbnails = [];
        for (let i = 1; i <= count; i++) {
          const thumbPath = path.join(tempDir, `thumb_${i}.jpg`);
          if (fs.existsSync(thumbPath)) {
            const buffer = fs.readFileSync(thumbPath);
            thumbnails.push(`data:image/jpeg;base64,${buffer.toString('base64')}`);
            fs.unlinkSync(thumbPath); // Clean up
          }
        }
        resolve(thumbnails);
      })
      .on('error', reject)
      .screenshots({
        count,
        folder: tempDir,
        filename: 'thumb_%i.jpg',
        size: '160x90'
      });
  });
});
