import {Index} from "../index";

export function pleaseReload(
    userId: number | number[],
    context: 'friend' | 'friendRequest' | 'event' | 'folder' | 'event-invite',
    id: number,
    mainId: number = 0
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

        // @TODO 19/02/2025: Remove when ready
        console.log(`Send ${context} to ${formattedUser}`)

        Index.io.to(formattedUser).emit('update', {
            context,
            id,
            mainId
        })
    } catch (e) {

    }
}
