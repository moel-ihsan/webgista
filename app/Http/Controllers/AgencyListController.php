<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreAgencyRequest;
use App\Http\Resources\AgencyListResource;
use App\Models\AgencyList;
use App\Services\AgencyService;
use Illuminate\Http\JsonResponse;

class AgencyListController extends Controller
{
    /**
     * @var AgencyService
     */
    private $service;

    public function __construct(AgencyService $service)
    {
        $this->service = $service;
    }

    /**
     * Return all agencies as a JSON array.
     */
    public function table_agency(): JsonResponse
    {
        $agencies = $this->service->listAll();

        return response()->json(AgencyListResource::collection($agencies)->resolve());
    }

    /**
     * Store a newly created agency tag.
     */
    public function store(StoreAgencyRequest $request): JsonResponse
    {
        $agency = $this->service->create($request->validated()['agency']);

        return response()->json((new AgencyListResource($agency))->resolve(), 201);
    }

    /**
     * Remove an agency tag.
     */
    public function destroy(AgencyList $agencyList): JsonResponse
    {
        $this->service->delete($agencyList);

        return response()->json(['message' => 'deleted']);
    }
}
