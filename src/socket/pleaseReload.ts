import {Index} from "../index";

export function pleaseReload(
    userId: number | number[],
    context: 'friend' | 'friendRequest' | 'event' | 'folder',
    id: number,
    mainId: number = 0
) {
    try {
        let formattedUser: string | string[] = [];

        if (Array.isArray(userId)) {
            formattedUser = userId.map(uid => uid.toString());
        } else {
            formattedUser = userId.toString();
        }

        Index.io.to(formattedUser).emit('update', {
            context,
            id,
            mainId
        })
    } catch (e) {

    }
}
