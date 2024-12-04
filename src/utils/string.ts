
/**
 * @author: HZWei
 * @date:  2024/12/5
 * @desc:
 */


function isEmpty(obj: string | any | undefined | null) {
    return obj === undefined || obj === null || (typeof obj ==='string' && obj.trim() === '')
}

function isNotEmpty(obj: string | any | undefined | null) {
    return !isEmpty(obj)
}

export  { isEmpty, isNotEmpty }

