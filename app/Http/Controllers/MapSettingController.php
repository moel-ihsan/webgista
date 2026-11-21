<?php

namespace App\Http\Controllers;

use App\Http\Requests\SaveMapSettingRequest;
use App\Http\Resources\MapSettingResource;
use App\Models\MapSetting;
use App\Services\MapSettingService;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;

class MapSettingController extends Controller
{
    /**
     * @var MapSettingService
     */
    private $service;

    public function __construct(MapSettingService $service)
    {
        $this->service = $service;
    }

    /**
     * Display the map settings view.
     */
    public function index(): View
    {
        return view('setting');
    }

    /**
     * Return all map settings as a JSON array.
     */
    public function table_setting(): JsonResponse
    {
        $settings = $this->service->listAll();

        return response()->json(MapSettingResource::collection($settings)->resolve());
    }

    /**
     * Store a new map setting configuration.
     */
    public function store(SaveMapSettingRequest $request): JsonResponse
    {
        $setting = $this->service->create($request->validated());

        return response()->json((new MapSettingResource($setting))->resolve(), 201);
    }

    /**
     * Show the form for editing the specified map setting.
     */
    public function edit(MapSetting $mapSetting): View
    {
        return view('setting', compact('mapSetting'));
    }

    /**
     * Update the specified map setting configuration.
     */
    public function update(SaveMapSettingRequest $request, MapSetting $mapSetting): JsonResponse
    {
        $updated = $this->service->update($mapSetting, $request->validated());

        return response()->json((new MapSettingResource($updated))->resolve());
    }
}
