# Bug Report: Mod Activation Copies Directories Instead of Files

## Issue Summary
The mod activation feature in Inzoi Mod Manager is currently copying entire directories instead of individual files, causing mods to not work properly in the inZoi game.

## Environment
- **Application**: Inzoi Mod Manager (Electron)
- **Platform**: Windows
- **Game**: inZoi
- **Issue Type**: Mod Activation Bug


## Problem Description

### Current Behavior
When users activate mods through the mod manager, the system copies the entire mod directory structure to the game's mods folder. However, the inZoi game engine only reads files that are directly in the ~mods folder and does not scan subdirectories.

### Expected Behavior
The mod activation should copy individual .package files from the mod directories and place them directly in the ~mods folder, ensuring they are loaded by the game.
