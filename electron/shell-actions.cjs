'use strict';

const { shell, clipboard } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fsp = require('fs').promises;

function psEscape(p) {
  return p.replace(/'/g, "''");
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      }
    );
  });
}

async function openPath(filePath) {
  const err = await shell.openPath(filePath);
  if (err) throw new Error(err);
}

function showInFolder(filePath) {
  shell.showItemInFolder(filePath);
}

async function showProperties(filePath) {
  const p = psEscape(filePath);
  const script = `
    $p = '${p}'
    $shell = New-Object -ComObject Shell.Application
    $dir = Split-Path -Parent $p
    $leaf = Split-Path -Leaf $p
    $folder = $shell.Namespace($dir)
    if ($folder -eq $null) { throw "Path not found" }
    $item = $folder.ParseName($leaf)
    if ($item -eq $null) { throw "Item not found" }
    $item.InvokeVerb('properties')
  `;
  await runPowerShell(script);
}

async function sendToDesktop(filePath) {
  const p = psEscape(filePath);
  const script = `
    $p = '${p}'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $name = [System.IO.Path]::GetFileNameWithoutExtension($p)
    if ([System.IO.Directory]::Exists($p)) { $name = [System.IO.Path]::GetFileName($p) }
    $lnk = Join-Path $desktop ($name + '.lnk')
    $i = 1
    while (Test-Path $lnk) {
      $lnk = Join-Path $desktop ($name + " ($i).lnk")
      $i++
    }
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut($lnk)
    $sc.TargetPath = $p
    $sc.WorkingDirectory = Split-Path -Parent $p
    $sc.Save()
  `;
  await runPowerShell(script);
}

function copyPath(filePath) {
  clipboard.writeText(filePath);
}

function copyFile(filePath) {
  clipboard.writeBuffer('FileNameW', Buffer.from(`${filePath}\0`, 'ucs2'));
}

async function trash(filePath) {
  await shell.trashItem(filePath);
}

async function rename(filePath, newName) {
  const dir = path.dirname(filePath);
  const dest = path.join(dir, newName);
  await fsp.rename(filePath, dest);
  return dest;
}

async function runShellAction(action, filePath, extra) {
  switch (action) {
    case 'open':
      return openPath(filePath);
    case 'show':
      return showInFolder(filePath);
    case 'properties':
      return showProperties(filePath);
    case 'desktop':
      return sendToDesktop(filePath);
    case 'copyPath':
      return copyPath(filePath);
    case 'copy':
      return copyFile(filePath);
    case 'trash':
      return trash(filePath);
    case 'rename':
      return rename(filePath, extra);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

module.exports = { runShellAction };
