import {Index} from "../index";

export function pleaseReload(
    userId: number | number[],
    context: 'friend' | 'friendRequest' | 'event' | 'folder' | 'event-invite',
    id: number,
    action: string = 'post'
) {
    try {
        if (!userId || (Array.isArray(userId) && userId?.length === 0)) {
            return;
        }

        let formattedUser: string | string[] = [];

        if (Array.isArray(userId)) {
            formattedUser = userId.map(uid => uid.toString());
        } else {
            formattedUser = userId.toString();
        }

        Index.io.to(formattedUser).emit('update', {
            context,
            id,
            action
        })
    } catch (e) {

    }
}
