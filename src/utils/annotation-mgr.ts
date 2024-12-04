/**
 * @author: HZWei
 * @date:  2024/12/5
 * @desc:
 */
import {AnnotationType} from "../models/model";


export default class AnnotationMgr {

   static  getAnnotation(text: string): AnnotationType {
        if (text == AnnotationType.ROUTE) {
            return AnnotationType.ROUTE
        } else if (text == AnnotationType.Z_ROUTE) {
            return AnnotationType.Z_ROUTE
        } else if (text == AnnotationType.SERVICE) {
            return AnnotationType.SERVICE
        } else if (text == AnnotationType.Z_SERVICE) {
            return AnnotationType.Z_SERVICE
        } else if (text == AnnotationType.Z_ATTRIBUTE) {
            return AnnotationType.Z_ATTRIBUTE
        } else if (text == AnnotationType.Z_LIFECYCLE) {
            return AnnotationType.Z_LIFECYCLE
        } else {
            return AnnotationType.Z_ROUTE
        }
    }

   static isRouteAnnotation(annotation: AnnotationType) {
        return [AnnotationType.ROUTE, AnnotationType.Z_ROUTE].includes(annotation)
    }


   static isServiceAnnotation(annotation: AnnotationType) {
        return [AnnotationType.SERVICE, AnnotationType.Z_SERVICE].includes(annotation)
    }

   static isAttrAnnotation(annotation: AnnotationType) {
        return [AnnotationType.Z_ATTRIBUTE].includes(annotation)
    }

   static isLifecycleAnnotation(annotation: AnnotationType) {
        return [AnnotationType.Z_LIFECYCLE].includes(annotation)
    }

    static isUnknownAnnotation(annotation: AnnotationType) {
        return [AnnotationType.UNKNOWN].includes(annotation)
    }

}