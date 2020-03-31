// Modules to control application life and create native browser window
const { app, BrowserWindow } = require('electron');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 350,
    height: 450,
    minHeight: 450,
    minWidth: 350,
    maxWidth: 350,
    //show: false,
    backgroundColor: '#222f3e',
    frame: false,
    icon: 'logo.ico',
    titleBarStyle: 'customButtonsOnHover',
    webPreferences: {
      nodeIntegration: true,
    },
    fullscreenable: false,
  });

  // Keep window always on top even with full screen apps
  //mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);

  // Load the main webpage
  mainWindow.loadFile('src/index.html');

  // Hide until window has mostly loaded content
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Destroy object, close app
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
