
function isEmpty(obj: string | undefined | null) {
    return obj === undefined || obj === null || obj.trim().length === 0
}

function isNotEmpty(obj: string | null | undefined) {
    return !isEmpty(obj)
}

export  { isEmpty, isNotEmpty }

