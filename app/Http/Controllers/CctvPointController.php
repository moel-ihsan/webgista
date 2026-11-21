<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCctvPointRequest;
use App\Http\Requests\UpdateCctvPointRequest;
use App\Http\Requests\UpdateCctvRoiRequest;
use App\Http\Requests\UpdateTrafficConditionRequest;
use App\Http\Requests\UploadImageRequest;
use App\Http\Resources\CctvPointResource;
use App\Models\CctvPoint;
use App\Services\CctvPointService;
use Illuminate\Http\JsonResponse;
use Illuminate\View\View;

class CctvPointController extends Controller
{
    /**
     * @var CctvPointService
     */
    private $service;

    public function __construct(CctvPointService $service)
    {
        $this->service = $service;
    }

    /**
     * Display the CCTV data table page.
     */
    public function index(): View
    {
        return view('table');
    }

    /**
     * Return all CCTV points as a flat JSON array.
     */
    public function table_api(): JsonResponse
    {
        $items = $this->service->listAll();

        return response()->json(CctvPointResource::collection($items)->resolve());
    }

    /**
     * Display the create CCTV form page.
     */
    public function create(): View
    {
        return view('add');
    }

    /**
     * Persist a newly created CCTV point.
     */
    public function store(StoreCctvPointRequest $request): JsonResponse
    {
        $cctvPoint = $this->service->create($request->validated());

        return response()->json([
            'data' => (new CctvPointResource($cctvPoint))->resolve(),
            'image' => $request->file('image'),
        ], 201);
    }

    /**
     * Display the CCTV detail view.
     */
    public function show(CctvPoint $cctvPoint): View
    {
        return view('detail', compact('cctvPoint'));
    }

    /**
     * Return the raw stream URL for an API detail lookup.
     */
    public function showCCTV(CctvPoint $cctvPoint): string
    {
        return (string) ($cctvPoint->url ?? '');
    }

    /**
     * Display the real-time video analysis view.
     */
    public function showvideo(CctvPoint $cctvPoint): View
    {
        return view('videodetail', compact('cctvPoint'));
    }

    /**
     * Display the edit CCTV form page.
     */
    public function edit(CctvPoint $cctvPoint): View
    {
        return view('edit', compact('cctvPoint'));
    }

    /**
     * Update an existing CCTV point.
     */
    public function update(UpdateCctvPointRequest $request, CctvPoint $cctvPoint): JsonResponse
    {
        $validated = $request->validated();
        $updated = $this->service->update($cctvPoint, $validated);

        return response()->json([
            'image' => $request->file('image'),
            'valid' => $validated,
            'data' => (new CctvPointResource($updated))->resolve(),
        ]);
    }

    /**
     * Update the traffic condition classification for a CCTV point.
     */
    public function update_keterangan(UpdateTrafficConditionRequest $request, CctvPoint $cctvPoint): JsonResponse
    {
        $updated = $this->service->updateCondition($cctvPoint, $request->validated()['keterangan']);

        return response()->json([
            'message' => 'berhasil',
            'keterangan' => $updated->keterangan,
        ]);
    }

    /**
     * Update the 5-point blue detection ROI polygon coordinates.
     */
    public function updateRoi(UpdateCctvRoiRequest $request, CctvPoint $cctvPoint): JsonResponse
    {
        $updated = $this->service->updateRoi($cctvPoint, $request->validated());

        return response()->json([
            'message' => 'ROI updated',
            'data' => (new CctvPointResource($updated))->resolve(),
        ]);
    }

    /**
     * Remove a CCTV point from storage.
     */
    public function destroy(CctvPoint $cctvPoint): JsonResponse
    {
        $this->service->delete($cctvPoint);

        return response()->json(['message' => 'deleted']);
    }

    /**
     * Upload a temporary CCTV thumbnail before creation.
     */
    public function upload(UploadImageRequest $request): JsonResponse
    {
        $path = $this->service->storeTemporaryImage($request->file('image'));

        return response()->json(['image' => $path]);
    }

    /**
     * Upload and attach a replacement thumbnail for an existing CCTV point.
     */
    public function uploadEdit(UploadImageRequest $request, CctvPoint $cctvPoint): JsonResponse
    {
        $path = $this->service->replaceImage($cctvPoint, $request->file('image'));

        return response()->json(['image' => $path]);
    }
}
