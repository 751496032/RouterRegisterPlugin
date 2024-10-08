
function isEmpty(obj: string | any | undefined | null) {
    return obj === undefined || obj === null || obj.trim().length === 0
}

function isNotEmpty(obj: string | any | undefined | null) {
    return !isEmpty(obj)
}

export  { isEmpty, isNotEmpty }

