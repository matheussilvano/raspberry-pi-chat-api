import dlib
import face_recognition_models
import numpy as np


face_detector = dlib.get_frontal_face_detector()
pose_predictor = dlib.shape_predictor(face_recognition_models.pose_predictor_model_location())
face_encoder = dlib.face_recognition_model_v1(face_recognition_models.face_recognition_model_location())


def _rect_to_css(rect):
    return rect.top(), rect.right(), rect.bottom(), rect.left()


def _css_to_rect(css):
    return dlib.rectangle(css[3], css[0], css[1], css[2])


def _trim_css_to_bounds(css, image_shape):
    return max(css[0], 0), min(css[1], image_shape[1]), min(css[2], image_shape[0]), max(css[3], 0)


def _raw_face_locations(img, number_of_times_to_upsample=1):
    return face_detector(img, number_of_times_to_upsample)


def _raw_face_landmarks(face_image, face_locations=None):
    if face_locations is None:
        face_locations = _raw_face_locations(face_image)
    else:
        face_locations = [_css_to_rect(face_location) for face_location in face_locations]

    return [pose_predictor(face_image, face_location) for face_location in face_locations]


def face_locations(img, number_of_times_to_upsample=1):
    return [
        _trim_css_to_bounds(_rect_to_css(face), img.shape)
        for face in _raw_face_locations(img, number_of_times_to_upsample)
    ]


def face_encodings(face_image, known_face_locations=None, num_jitters=1):
    raw_landmarks = _raw_face_landmarks(face_image, known_face_locations)
    return [
        np.array(face_encoder.compute_face_descriptor(face_image, raw_landmark_set, num_jitters))
        for raw_landmark_set in raw_landmarks
    ]


def face_distance(face_encodings, face_to_compare):
    if len(face_encodings) == 0:
        return np.empty((0))

    return np.linalg.norm(face_encodings - face_to_compare, axis=1)


def compare_faces(known_face_encodings, face_encoding_to_check, tolerance=0.6):
    return list(face_distance(known_face_encodings, face_encoding_to_check) <= tolerance)
