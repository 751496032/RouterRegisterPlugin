/**
 * @author: HZWei
 * @date:  2024/12/5
 * @desc:
 */
import {logger} from "./logger";


function isEmpty(obj: string | any | undefined | null) {
    return obj === undefined || obj === null || (typeof obj ==='string' && obj.trim() === '')
}

function isNotEmpty(obj: string | any | undefined | null) {
    return !isEmpty(obj)
}

function safeBase64Encode(obj: any): string{
    try {
        return Buffer.from(JSON.stringify(obj)).toString('base64');
    } catch (error) {
       logger('Base64 encoding failed:', error);
        return "";
    }
}




export  { isEmpty, isNotEmpty,safeBase64Encode }

