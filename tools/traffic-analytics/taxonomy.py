"""Explicit COCO class mapping; unsupported detections are never promoted to vehicles."""

COCO_VEHICLES = {
    1: ('bicycle', 'bicycle'),
    2: ('car', 'LV'),
    3: ('motorcycle', 'MC'),
    5: ('bus', 'HV'),
    7: ('truck', 'HV'),
}
TRAFFIC_CATEGORIES = ('LV', 'HV', 'MC', 'bicycle')
TRAFFIC_CATEGORY_BY_CLASS = {vehicle_class: category for vehicle_class, category in COCO_VEHICLES.values()}


def map_coco_vehicle(class_id):
    """Return model class and traffic category, or None for unsupported COCO classes."""
    return COCO_VEHICLES.get(int(class_id))
