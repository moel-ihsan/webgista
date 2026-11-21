<?php

namespace App\Services;

use App\Models\AgencyList;
use Illuminate\Database\Eloquent\Collection;

class AgencyService
{
    /**
     * Retrieve all agency records.
     *
     * @return Collection<int, AgencyList>
     */
    public function listAll(): Collection
    {
        return AgencyList::get();
    }

    /**
     * Create a new agency record.
     */
    public function create(string $agency): AgencyList
    {
        return AgencyList::create(['agency' => $agency]);
    }

    /**
     * Delete an existing agency record.
     */
    public function delete(AgencyList $agencyList): void
    {
        $agencyList->delete();
    }
}
