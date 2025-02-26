import * as apn from "node-apn";
import {Index} from "../index";

export class ApnUtils {
    public static sendAPNNotification(notificationType: string, eventId: number, deviceToken: string, eventName: string = null, folderName: string = null) {
        const note = new apn.Notification();
        note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expire dans 1 heure
        note.badge = 3;
        note.sound = "ping.aiff";

        switch (notificationType) {
            case "event":
                note.alert = {
                    body: "Un évènement a été créé dans un dossier !",
                    "loc-key": "push_event_created_in_folder",
                    "loc-args": [folderName]
                };

                note.payload = {eventId, type: "event"};
                break;
            case "event-invite":
                note.alert = {
                    body: "Vous avez été invité dans un évènement !",
                    "loc-key": "push_invited_to_event",
                };

                note.payload = {eventId, type: "event-invite"};
                break;
            case "event-update":
                if (folderName) {
                    note.alert = {
                        body: "Un évènement au quel vous appartenez a été mis a jour !",
                        "loc-key": "push_event_modified",
                        "loc-args": [eventName, folderName]
                    };
                } else {
                    note.alert = {
                        body: "Un évènement au quel vous appartenez a été mis a jour !",
                        "loc-key": "push_event_modified",
                        "loc-args": [eventName]
                    };
                }

                note.payload = {eventId, type: "event-update"};
                break;
            default:
                return;
        }

        note.topic = "sementa.com.Evently";

        Index.apns.send(note, deviceToken)
            .then(result => {
            })
            .catch(error => {
            });
    }
}
