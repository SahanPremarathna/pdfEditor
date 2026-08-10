export const CH = {
  OPEN_DIALOG: 'file:openDialog',
  READ_FILE: 'file:read',
  SAVE: 'file:save',
  SAVE_AS: 'file:saveAs',
  DIRTY_CHANGED: 'doc:dirtyChanged',
  REQUEST_SAVE_BEFORE_CLOSE: 'doc:requestSaveBeforeClose',
  SAVE_BEFORE_CLOSE_RESULT: 'doc:saveBeforeCloseResult',
  RECENT_GET: 'recent:get',
  RECENT_ADD: 'recent:add',
  // Cold-start file-association open (double-click a .pdf / "Open with").
  // Pulled once on mount rather than pushed, to avoid a startup race against
  // the renderer's listener not being registered yet — see useLaunchFileOpen.
  GET_LAUNCH_PATH: 'file:getLaunchPath',
  // Not in the original spec's channel sketch, but required to implement its
  // own `onMenuAction` renderer API — main sends the clicked menu item's
  // action string, the renderer dispatches it to the matching store call.
  MENU_ACTION: 'menu:action'
} as const
