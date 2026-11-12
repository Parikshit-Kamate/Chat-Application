import { createAuthActions } from './authActions';
import { createFriendActions } from './friendActions';
import { createGroupCreationActions } from './groupCreationActions';
import { createGroupRenameAction } from './groupRenameAction';
import { createGroupAddMembersAction } from './groupAddMembersAction';
import { createGroupRemoveMemberActions } from './groupRemoveMemberActions';
import { createSendMessageActions } from './sendMessageActions';
import { createAttachmentAction } from './attachmentAction';
import { createContextMenuAction } from './contextMenuAction';
import { createSearchResultAction } from './searchResultAction';

export function createControllerActions(context) {
  return {
    ...createAuthActions(context),
    ...createFriendActions(context),
    ...createGroupCreationActions(context),
    ...createGroupRenameAction(context),
    ...createGroupAddMembersAction(context),
    ...createGroupRemoveMemberActions(context),
    ...createSendMessageActions(context),
    ...createAttachmentAction(context),
    ...createContextMenuAction(context),
    ...createSearchResultAction(context),
  };
}
